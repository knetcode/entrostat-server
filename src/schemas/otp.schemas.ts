import { z } from "zod";

/**
 * Email validation schema
 * We use z.preprocess to handle trimming and lowercasing before validation
 */
const emailSchema = z.preprocess(
  (val) => {
    if (typeof val === "string") {
      return val.trim().toLowerCase();
    }
    return val;
  },
  z
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email address is too long. Please use a shorter email address." })
    .meta({ description: "Email address", title: "Email" })
    .default("test@example.com")
);

/**
 * OTP code validation schema
 * Must be exactly 6 digits
 * Regex validation is sufficient - no need for redundant min/max checks
 */
const otpCodeSchema = z
  .string({ message: "Please enter your OTP code" })
  .trim()
  .regex(/^\d{6}$/, { message: "Please enter a 6-digit code" })
  .meta({ description: "OTP code", title: "OTP" })
  .default("123456");

/**
 * Schema for POST /api/otp/send request
 */
export const sendOtpSchema = z
  .object({
    email: emailSchema,
  })
  .meta({
    description: "Request to send an OTP to the user's email address",
    title: "Send OTP Request",
  });

/**
 * Schema for POST /api/otp/resend request
 */
export const resendOtpSchema = z
  .object({
    email: emailSchema,
  })
  .meta({
    description: "Request to resend an OTP to the user's email address",
    title: "Resend OTP Request",
  });

/**
 * Schema for POST /api/otp/verify request
 */
export const verifyOtpSchema = z
  .object({
    email: emailSchema,
    otp: otpCodeSchema,
  })
  .meta({
    description: "Request to verify an OTP",
    title: "Verify OTP Request",
  });

/**
 * Response schemas
 */

// Error item schema - defines the structure of individual validation errors
export const errorItemSchema = z
  .object({
    code: z.string().default("invalid_string"),
    path: z.array(z.string()).default(["email"]),
    message: z.string().default("Please enter a valid email address"),
  })
  .meta({
    description: "Individual validation error item",
    title: "Error Item",
  });

// Success response for send/resend OTP
export const successResponseSchema = z.object({
  success: z.literal(true).default(true),
  message: z.string().default("OTP sent successfully"),
  correlationId: z.uuid().default(crypto.randomUUID()).optional(),
});

// Error response with validation errors
export const errorResponseSchema = z
  .object({
    success: z.literal(false).default(false),
    message: z.string().default("Please enter a valid email address"),
    errors: z
      .array(errorItemSchema)
      .default([{ code: "invalid_email", path: ["email"], message: "Invalid email format" }]),
    correlationId: z.uuid().default(crypto.randomUUID()).optional(),
  })
  .meta({
    description: "Error response for send/resend/verify OTP",
    title: "Error Response",
  });

// Verify success response
export const verifySuccessResponseSchema = z
  .object({
    success: z.literal(true).default(true),
    valid: z.literal(true).default(true),
    message: z.string().default("OTP verified successfully"),
    correlationId: z.uuid().default(crypto.randomUUID()).optional(),
  })
  .meta({
    description: "Success response for verify OTP",
    title: "Verify Success Response",
  });

// Verify error response (invalid/expired OTP)
export const verifyErrorResponseSchema = z
  .object({
    success: z.literal(true).default(true),
    valid: z.literal(false).default(false),
    message: z.string().default("Invalid or expired OTP"),
  })
  .meta({
    description: "Error response for verify OTP",
    title: "Verify Error Response",
  });

// Rate limit response
export const rateLimitResponseSchema = z
  .object({
    success: z.literal(false).default(false),
    message: z.string().default("Rate limit exceeded"),
    correlationId: z.uuid().default(crypto.randomUUID()).optional(),
  })
  .meta({
    description: "Rate limit response",
    title: "Rate Limit Response",
  });

/**
 * Type inference for request bodies
 */
export type SendOtpRequest = z.infer<typeof sendOtpSchema>;
export type ResendOtpRequest = z.infer<typeof resendOtpSchema>;
export type VerifyOtpRequest = z.infer<typeof verifyOtpSchema>;

/**
 * Type inference for response bodies
 */
export type SuccessResponse = z.infer<typeof successResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type VerifySuccessResponse = z.infer<typeof verifySuccessResponseSchema>;
export type VerifyErrorResponse = z.infer<typeof verifyErrorResponseSchema>;
export type RateLimitResponse = z.infer<typeof rateLimitResponseSchema>;

/**
 * Type for individual error items in ErrorResponse
 */
export type ErrorItem = ErrorResponse["errors"][number];
