/**
 * Database cleanup utilities for tests
 * Cleans up test data between tests to avoid interference
 */

import { db } from "../../db";
import { otpRecords, otpHistory, otpRateLimit } from "../../db/schema";
import { eq, desc } from "drizzle-orm";
import { generateUUID } from "./api-client";

/**
 * Clean up all OTP-related data for a specific email
 * Useful for isolating tests
 */
export async function cleanupEmail(email: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  // Delete in order to respect foreign key constraints (if any)
  await db.delete(otpRecords).where(eq(otpRecords.email, normalizedEmail));
  await db.delete(otpHistory).where(eq(otpHistory.email, normalizedEmail));
  await db.delete(otpRateLimit).where(eq(otpRateLimit.email, normalizedEmail));
}

/**
 * Clean up all OTP-related data for multiple emails
 */
export async function cleanupEmails(emails: string[]): Promise<void> {
  await Promise.all(emails.map((email) => cleanupEmail(email)));
}

/**
 * Get the latest OTP code for an email (for testing purposes)
 * This allows us to verify the OTP was generated correctly
 */
export async function getLatestOtpCode(email: string): Promise<string | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const results = await db
    .select({ otpCode: otpRecords.otpCode })
    .from(otpRecords)
    .where(eq(otpRecords.email, normalizedEmail))
    .orderBy(desc(otpRecords.createdAt))
    .limit(1);

  return results[0]?.otpCode ?? null;
}

/**
 * Get OTP record details for an email (for testing)
 */
export async function getLatestOtpRecord(email: string) {
  const normalizedEmail = email.toLowerCase().trim();

  const results = await db
    .select()
    .from(otpRecords)
    .where(eq(otpRecords.email, normalizedEmail))
    .orderBy(desc(otpRecords.createdAt))
    .limit(1);

  return results[0] ?? null;
}

/**
 * Get all OTP history entries for an email (for testing uniqueness)
 */
export async function getOtpHistory(email: string) {
  const normalizedEmail = email.toLowerCase().trim();

  return db.select().from(otpHistory).where(eq(otpHistory.email, normalizedEmail)).orderBy(desc(otpHistory.createdAt));
}

/**
 * Insert an OTP record with a specific timestamp (for testing time-based behavior)
 * Useful for testing resend window expiry and OTP invalidation
 */
export async function insertOtpRecord(
  email: string,
  otpCode: string,
  options: {
    createdAt?: Date;
    expiresAt?: Date;
    resendCount?: number;
    used?: boolean;
    invalidated?: boolean;
    correlationId?: string;
  } = {}
) {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  const record = {
    email: normalizedEmail,
    otpCode,
    correlationId: options.correlationId ?? generateUUID(),
    createdAt: options.createdAt ?? now,
    expiresAt: options.expiresAt ?? new Date(now.getTime() + 30 * 1000), // 30 seconds default
    resendCount: options.resendCount ?? 0,
    used: options.used ?? false,
    invalidated: options.invalidated ?? false,
  };

  await db.insert(otpRecords).values(record);

  // Also add to history for uniqueness tracking
  await db.insert(otpHistory).values({
    email: normalizedEmail,
    otpCode,
    correlationId: record.correlationId,
    createdAt: record.createdAt,
  });

  return record;
}

/**
 * Get all active (non-used, non-invalidated) OTP records for an email
 */
export async function getActiveOtpRecords(email: string) {
  const normalizedEmail = email.toLowerCase().trim();

  return db.select().from(otpRecords).where(eq(otpRecords.email, normalizedEmail)).orderBy(desc(otpRecords.createdAt));
}

/**
 * Insert multiple OTP codes into history (for testing uniqueness)
 */
export async function insertOtpHistoryCodes(email: string, otpCodes: string[]) {
  const normalizedEmail = email.toLowerCase().trim();

  for (const otpCode of otpCodes) {
    await db.insert(otpHistory).values({
      email: normalizedEmail,
      otpCode,
      correlationId: generateUUID(),
      createdAt: new Date(),
    });
  }
}
