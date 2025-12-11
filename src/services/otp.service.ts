import { db } from "../db";
import { otpRecords, otpHistory, otpRateLimit, type OtpRecord } from "../db/schema";
import { config } from "../config/otp";
import { eq, and, gte, desc, count } from "drizzle-orm";
import { sendOtpEmail } from "./email.service";

/**
 * Custom error classes for OTP service
 */

/**
 * Error thrown when rate limit is exceeded
 * @extends {Error}
 */
export class RateLimitError extends Error {
  constructor(message: string = "Rate limit exceeded") {
    super(message);
    this.name = "RateLimitError";
  }
}

/**
 * Error thrown when no active OTP is found for an email address
 * @extends {Error}
 */
export class OtpNotFoundError extends Error {
  constructor(message: string = "No active OTP found") {
    super(message);
    this.name = "OtpNotFoundError";
  }
}

/**
 * Error thrown when an OTP has expired or is outside the resend window
 * @extends {Error}
 */
export class OtpExpiredError extends Error {
  constructor(message: string = "OTP has expired") {
    super(message);
    this.name = "OtpExpiredError";
  }
}

/**
 * Error thrown when the provided OTP code doesn't match the stored OTP
 * @extends {Error}
 */
export class InvalidOtpError extends Error {
  constructor(message: string = "Invalid OTP") {
    super(message);
    this.name = "InvalidOtpError";
  }
}

/**
 * Error thrown when the maximum resend count has been exceeded
 * @extends {Error}
 */
export class MaxResendExceededError extends Error {
  constructor(message: string = "Maximum resend count exceeded") {
    super(message);
    this.name = "MaxResendExceededError";
  }
}

/**
 * Normalize email to lowercase and trim whitespace
 * @param email - Email address to normalize
 * @returns Normalized email address (lowercase, trimmed)
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Generate a random 6-digit OTP code as a string
 * @returns OTP code as a string (e.g., "123456")
 */
export function generateOTP(): string {
  const otpLength = 6;

  const min = Math.pow(10, otpLength - 1);
  const max = Math.pow(10, otpLength) - 1;

  const otp = Math.floor(Math.random() * (max - min + 1)) + min;

  return otp.toString().padStart(otpLength, "000000");
}

/**
 * Check if rate limit is exceeded for an email address
 * @param email - Email address to check rate limit for
 * @throws {RateLimitError} If rate limit exceeded (max requests per hour)
 */
async function checkRateLimit(email: string): Promise<void> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const result = await db
    .select({ count: count() })
    .from(otpRateLimit)
    .where(and(eq(otpRateLimit.email, email), gte(otpRateLimit.requestedAt, oneHourAgo)));

  const requestCount = result[0]?.count ?? 0;

  if (requestCount >= config.MAX_OTP_REQUESTS_PER_HOUR) {
    throw new RateLimitError(
      `You've reached the limit of ${config.MAX_OTP_REQUESTS_PER_HOUR} OTP requests per hour. Please wait about an hour before trying again.`
    );
  }
}

/**
 * Get OTPs used in the specified time window for uniqueness check
 * @param email - Email address to check OTP history for
 * @param windowHours - Number of hours to look back for used OTPs
 * @returns Set of OTP codes that have been used in the time window
 */
async function getUsedOtpsInWindow(email: string, windowHours: number): Promise<Set<string>> {
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const history = await db
    .select({ otpCode: otpHistory.otpCode })
    .from(otpHistory)
    .where(and(eq(otpHistory.email, email), gte(otpHistory.createdAt, windowStart)));

  return new Set(history.map((h) => h.otpCode));
}

/**
 * Generate a unique OTP that hasn't been used in the uniqueness window
 * @param email - Email address to generate OTP for
 * @returns Unique 6-digit OTP code as a string
 * @throws {Error} If unable to generate unique OTP after maximum attempts (100)
 */
async function generateUniqueOtp(email: string): Promise<string> {
  const usedOtps = await getUsedOtpsInWindow(email, config.OTP_UNIQUENESS_WINDOW_HOURS);

  const maxAttempts = 100;
  for (let i = 0; i < maxAttempts; i++) {
    const otp = generateOTP();
    if (!usedOtps.has(otp)) {
      return otp;
    }
  }

  throw new Error("We're experiencing high demand. Please try again in a moment.");
}

/**
 * Get the latest active (non-used, non-invalidated) OTP for an email address
 * @param email - Email address to find OTP for
 * @returns Latest active OTP record, or null if none found
 */
async function getLatestActiveOtp(email: string): Promise<OtpRecord | null> {
  const results = await db
    .select()
    .from(otpRecords)
    .where(and(eq(otpRecords.email, email), eq(otpRecords.used, false), eq(otpRecords.invalidated, false)))
    .orderBy(desc(otpRecords.createdAt))
    .limit(1);

  return results[0] ?? null;
}

/**
 * Check if an existing OTP can be resent (within resend window)
 * @param otp - OTP record to check
 * @returns true if OTP is within resend window, false otherwise
 */
function canResendExistingOtp(otp: OtpRecord): boolean {
  const createdAt = otp.createdAt instanceof Date ? otp.createdAt : new Date(otp.createdAt);
  const resendWindowEnd = new Date(createdAt.getTime() + config.OTP_RESEND_WINDOW_MINUTES * 60 * 1000);
  return new Date() < resendWindowEnd;
}

/**
 * Invalidate all existing active (non-used, non-invalidated) OTPs for an email address
 * This is called when a new OTP is generated to ensure only one active OTP exists at a time
 * @param email - Email address to invalidate OTPs for
 */
async function invalidateOldOtps(email: string): Promise<void> {
  await db
    .update(otpRecords)
    .set({ invalidated: true })
    .where(and(eq(otpRecords.email, email), eq(otpRecords.used, false), eq(otpRecords.invalidated, false)));
}

/**
 * Constant-time OTP comparison to prevent timing attacks
 * Compares two strings in constant time regardless of where they differ
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Send OTP to email address
 *
 * This function handles the complete OTP generation and sending flow:
 * - Checks rate limits
 * - Auto-resends existing OTP if within resend window
 * - Generates unique OTP (24-hour uniqueness check)
 * - Invalidates old OTPs
 * - Stores OTP record and history
 * - Records rate limit entry
 *
 * @param email - Email address to send OTP to
 * @param correlationId - Correlation ID for tracking the user flow
 * @returns The generated OTP code (for testing - will be removed when email service is integrated)
 * @throws {RateLimitError} If rate limit exceeded (max requests per hour)
 */
export async function sendOtp(email: string, correlationId: string): Promise<string> {
  const normalizedEmail = normalizeEmail(email);

  // Check rate limit
  await checkRateLimit(normalizedEmail);

  // Record rate limit entry immediately after check passes
  // This ensures every request (new or resend) counts against the rate limit
  await db.insert(otpRateLimit).values({
    email: normalizedEmail,
    correlationId,
    requestedAt: new Date(),
  });

  // Check if we can resend existing OTP
  const existingOtp = await getLatestActiveOtp(normalizedEmail);
  if (existingOtp && canResendExistingOtp(existingOtp)) {
    // Treat as resend (rate limit already recorded above)
    return resendOtp(normalizedEmail);
  }

  // Generate unique OTP
  const otp = await generateUniqueOtp(normalizedEmail);

  // Invalidate old OTPs
  await invalidateOldOtps(normalizedEmail);

  // Calculate expiry
  const expiresAt = new Date(Date.now() + config.OTP_EXPIRY_SECONDS * 1000);

  // Store new OTP record
  await db.insert(otpRecords).values({
    email: normalizedEmail,
    otpCode: otp,
    correlationId,
    expiresAt,
    resendCount: 0,
    used: false,
    invalidated: false,
  });

  // Add to OTP history for uniqueness tracking
  await db.insert(otpHistory).values({
    email: normalizedEmail,
    otpCode: otp,
    correlationId,
  });

  // Send OTP email
  await sendOtpEmail(normalizedEmail, otp);

  return otp;
}

/**
 * Resend existing OTP to email address
 *
 * This function resends an existing OTP if:
 * - An active OTP exists for the email
 * - The OTP is within the resend window (default: 5 minutes)
 * - The resend count hasn't exceeded the maximum (default: 3)
 *
 * The expiry time is extended when resending.
 *
 * @param email - Email address to resend OTP to
 * @returns The OTP code (for testing - will be removed when email service is integrated)
 * @throws {OtpNotFoundError} If no active OTP found
 * @throws {OtpExpiredError} If OTP is outside resend window
 * @throws {MaxResendExceededError} If max resend count exceeded
 */
export async function resendOtp(email: string): Promise<string> {
  const normalizedEmail = normalizeEmail(email);

  // Find latest active OTP
  const otpRecord = await getLatestActiveOtp(normalizedEmail);

  if (!otpRecord) {
    throw new OtpNotFoundError("No OTP code found for this email. Please request a new one to continue.");
  }

  // Check if within resend window
  if (!canResendExistingOtp(otpRecord)) {
    throw new OtpExpiredError("Your OTP code has expired. Please request a new one to continue.");
  }

  // Check resend count
  if (otpRecord.resendCount >= config.MAX_RESEND_COUNT) {
    throw new MaxResendExceededError(
      `You've reached the maximum number of resends (${config.MAX_RESEND_COUNT}). Please request a new OTP code.`
    );
  }

  // Increment resend count
  const newExpiresAt = new Date(Date.now() + config.OTP_EXPIRY_SECONDS * 1000);

  await db
    .update(otpRecords)
    .set({
      resendCount: otpRecord.resendCount + 1,
      expiresAt: newExpiresAt,
    })
    .where(eq(otpRecords.id, otpRecord.id));

  // Resend OTP email
  await sendOtpEmail(normalizedEmail, otpRecord.otpCode);

  return otpRecord.otpCode;
}

/**
 * Verify OTP for email address
 *
 * This function verifies an OTP by:
 * - Finding the latest active OTP for the email
 * - Checking if the OTP has expired
 * - Performing constant-time comparison to prevent timing attacks
 * - Marking the OTP as used upon successful verification
 *
 * @param email - Email address associated with the OTP
 * @param otp - OTP code to verify (6-digit string)
 * @returns true if OTP is valid and verified successfully
 * @throws {OtpNotFoundError} If no active OTP found for the email
 * @throws {OtpExpiredError} If OTP has expired
 * @throws {InvalidOtpError} If OTP doesn't match the stored code
 */
export async function verifyOtp(email: string, otp: string): Promise<boolean> {
  const normalizedEmail = normalizeEmail(email);
  const normalizedOtp = otp.trim();

  // Find latest active OTP
  const otpRecord = await getLatestActiveOtp(normalizedEmail);

  if (!otpRecord) {
    throw new OtpNotFoundError("No active OTP found for this email.");
  }

  // Check if expired
  const expiresAt = otpRecord.expiresAt instanceof Date ? otpRecord.expiresAt : new Date(otpRecord.expiresAt);
  if (new Date() > expiresAt) {
    throw new OtpExpiredError("This OTP code has expired. Please request a new one.");
  }

  // Constant-time comparison
  if (!constantTimeCompare(normalizedOtp, otpRecord.otpCode)) {
    throw new InvalidOtpError("The OTP code you entered is incorrect. Please check and try again.");
  }

  // Mark as used
  await db.update(otpRecords).set({ used: true }).where(eq(otpRecords.id, otpRecord.id));

  return true;
}
