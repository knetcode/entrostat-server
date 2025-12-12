import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  sendOtp,
  resendOtp,
  verifyOtp,
  RateLimitError,
  OtpNotFoundError,
  OtpExpiredError,
  InvalidOtpError,
  MaxResendExceededError,
} from "../services/otp.service";
import {
  sendOtpSchema,
  resendOtpSchema,
  verifyOtpSchema,
  type SuccessResponse,
  type ErrorResponse,
  type ErrorItem,
  type VerifySuccessResponse,
  type RateLimitResponse,
} from "../schemas/otp.schemas";
import {
  sendOtpRequestSchema,
  resendOtpRequestSchema,
  verifyOtpRequestSchema,
  successResponseSchema,
  errorResponseSchema,
  verifySuccessResponseSchema,
  rateLimitResponseSchema,
} from "../schemas/json-schemas";
import { logError, extractErrorDetails } from "../services/error-log.service";

/**
 * Convert a Zod issue to an ErrorItem
 * @param issue - Zod validation issue (from ZodError.issues array)
 * @returns ErrorItem matching the ErrorResponse schema
 */
function zodIssueToErrorItem(issue: z.ZodError["issues"][number]): ErrorItem {
  return {
    code: issue.code,
    path: issue.path.map(String),
    message: issue.message,
  };
}

/**
 * Register OTP routes with Fastify instance
 * @param app - Fastify instance
 */
export async function otpRoutes(app: FastifyInstance) {
  /**
   * POST /api/otp/send
   * Request a new OTP or resend existing OTP if within resend window
   */
  app.post(
    "/api/otp/send",
    {
      schema: {
        description: "Send a new OTP or resend existing OTP if within resend window",
        tags: ["OTP"],
        headers: {
          type: "object",
          properties: {
            correlationid: {
              type: "string",
              description: "Correlation ID (uuid) for request tracking",
            },
          },
          required: ["correlationid"],
        },
        body: sendOtpRequestSchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          429: rateLimitResponseSchema,
          500: errorResponseSchema,
        },
      },
      attachValidation: true,
    },
    async (request, reply) => {
      // Extract and validate correlationId from headers (required)
      const correlationId = request.headers["correlationid"] as string | undefined;

      if (!correlationId) {
        const errorResponse: ErrorResponse = {
          success: false,
          message: "Correlation ID is required",
          errors: [],
        };
        return reply.status(400).send(errorResponse);
      }

      // Extract email from request body for error logging
      const requestBody = request.body as { email?: string };
      const emailForLogging = requestBody?.email;

      try {
        // Validate request body
        const validationResult = sendOtpSchema.safeParse(request.body);

        if (!validationResult.success) {
          // Use the first error message for single errors, or a friendly message for multiple
          const mainMessage =
            validationResult.error.issues.length === 1
              ? validationResult.error.issues[0].message
              : "Please check your input and try again.";

          const errorResponse: ErrorResponse = {
            success: false,
            message: mainMessage,
            errors: validationResult.error.issues.map(zodIssueToErrorItem),
            correlationId,
          };
          return reply.status(400).send(errorResponse);
        }

        const { email } = validationResult.data;

        // Send OTP (service handles auto-resend logic)
        await sendOtp(email, correlationId);

        const successResponse: SuccessResponse = {
          success: true,
          message: "OTP sent successfully",
          correlationId,
        };
        return reply.status(200).send(successResponse);
      } catch (error) {
        // Handle rate limit errors
        if (error instanceof RateLimitError) {
          // Log rate limit errors for monitoring
          await logError({
            correlationId,
            email: emailForLogging,
            errorMessage: error.message,
            errorType: error.name,
            requestPath: "/api/otp/send",
            requestMethod: "POST",
          });

          const rateLimitResponse: RateLimitResponse = {
            success: false,
            message: error.message,
            correlationId,
          };
          return reply.status(429).send(rateLimitResponse);
        }

        // Log unexpected errors
        app.log.error(error);

        // Log error to database for debugging
        const errorDetails = extractErrorDetails(error);
        await logError({
          correlationId,
          email: emailForLogging,
          errorMessage: errorDetails.message,
          errorType: errorDetails.type,
          errorStack: errorDetails.stack,
          requestPath: "/api/otp/send",
          requestMethod: "POST",
        });

        // Generic error response (don't leak internal details)
        const errorResponse: ErrorResponse = {
          success: false,
          message: "Something went wrong while sending your OTP. Please try again in a moment.",
          errors: [],
          correlationId,
        };
        return reply.status(500).send(errorResponse);
      }
    }
  );

  /**
   * POST /api/otp/resend
   * Resend an existing OTP if within resend window
   */
  app.post(
    "/api/otp/resend",
    {
      schema: {
        description: "Resend an existing OTP if within resend window",
        tags: ["OTP"],
        headers: {
          type: "object",
          properties: {
            correlationid: {
              type: "string",
              description: "Correlation ID (uuid) for request tracking",
            },
          },
          required: ["correlationid"],
        },
        body: resendOtpRequestSchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
      attachValidation: true,
    },
    async (request, reply) => {
      // Extract and validate correlationId from headers (required)
      const correlationId = request.headers["correlationid"] as string | undefined;

      if (!correlationId) {
        const errorResponse: ErrorResponse = {
          success: false,
          message: "Correlation ID is required",
          errors: [],
        };
        return reply.status(400).send(errorResponse);
      }

      // Extract email from request body for error logging
      const requestBody = request.body as { email?: string };
      const emailForLogging = requestBody?.email;

      try {
        // Validate request body
        const validationResult = resendOtpSchema.safeParse(request.body);

        if (!validationResult.success) {
          // Use the first error message for single errors, or a friendly message for multiple
          const mainMessage =
            validationResult.error.issues.length === 1
              ? validationResult.error.issues[0].message
              : "Please check your input and try again.";

          const errorResponse: ErrorResponse = {
            success: false,
            message: mainMessage,
            errors: validationResult.error.issues.map(zodIssueToErrorItem),
            correlationId,
          };
          return reply.status(400).send(errorResponse);
        }

        const { email } = validationResult.data;

        // Resend OTP (uses correlationId from existing OTP record)
        await resendOtp(email);

        const successResponse: SuccessResponse = {
          success: true,
          message: "OTP resent successfully",
          correlationId,
        };
        return reply.status(200).send(successResponse);
      } catch (error) {
        // Handle specific OTP errors
        if (error instanceof OtpNotFoundError) {
          const errorResponse: ErrorResponse = {
            success: false,
            message: error.message,
            errors: [],
            correlationId,
          };
          return reply.status(400).send(errorResponse);
        }

        if (error instanceof OtpExpiredError) {
          const errorResponse: ErrorResponse = {
            success: false,
            message: error.message,
            errors: [],
            correlationId,
          };
          return reply.status(400).send(errorResponse);
        }

        if (error instanceof MaxResendExceededError) {
          const errorResponse: ErrorResponse = {
            success: false,
            message: error.message,
            errors: [],
            correlationId,
          };
          return reply.status(400).send(errorResponse);
        }

        // Log unexpected errors
        app.log.error(error);

        // Log error to database for debugging
        const errorDetails = extractErrorDetails(error);
        await logError({
          correlationId,
          email: emailForLogging,
          errorMessage: errorDetails.message,
          errorType: errorDetails.type,
          errorStack: errorDetails.stack,
          requestPath: "/api/otp/resend",
          requestMethod: "POST",
        });

        // Generic error response
        const errorResponse: ErrorResponse = {
          success: false,
          message: "Something went wrong while resending your OTP. Please try again in a moment.",
          errors: [],
          correlationId,
        };
        return reply.status(500).send(errorResponse);
      }
    }
  );

  /**
   * POST /api/otp/verify
   * Verify an OTP code
   */
  app.post(
    "/api/otp/verify",
    {
      schema: {
        description: "Verify an OTP code",
        tags: ["OTP"],
        headers: {
          type: "object",
          properties: {
            correlationid: {
              type: "string",
              description: "Correlation ID (uuid) for request tracking",
            },
          },
          required: ["correlationid"],
        },
        body: verifyOtpRequestSchema,
        response: {
          200: verifySuccessResponseSchema,
          400: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
      attachValidation: true,
    },
    async (request, reply) => {
      // Extract and validate correlationId from headers (required)
      const correlationId = request.headers["correlationid"] as string | undefined;

      if (!correlationId) {
        const errorResponse: ErrorResponse = {
          success: false,
          message: "Correlation ID is required",
          errors: [],
        };
        return reply.status(400).send(errorResponse);
      }

      // Extract email from request body for error logging
      const requestBody = request.body as { email?: string };
      const emailForLogging = requestBody?.email;

      try {
        // Validate request body
        const validationResult = verifyOtpSchema.safeParse(request.body);

        if (!validationResult.success) {
          // Use the first error message for single errors, or a friendly message for multiple
          const mainMessage =
            validationResult.error.issues.length === 1
              ? validationResult.error.issues[0].message
              : "Please check your input and try again.";

          const errorResponse: ErrorResponse = {
            success: false,
            message: mainMessage,
            errors: validationResult.error.issues.map(zodIssueToErrorItem),
            correlationId,
          };
          return reply.status(400).send(errorResponse);
        }

        const { email, otp } = validationResult.data;

        // Verify OTP
        const isValid = await verifyOtp(email, otp);

        if (isValid) {
          const verifySuccessResponse: VerifySuccessResponse = {
            success: true,
            valid: true,
            message: "OTP verified successfully",
            correlationId,
          };
          return reply.status(200).send(verifySuccessResponse);
        }

        // This shouldn't happen (verifyOtp throws errors), but handle it anyway
        const errorResponse: ErrorResponse = {
          success: false,
          message: "Invalid or expired OTP",
          errors: [],
          correlationId,
        };
        return reply.status(400).send(errorResponse);
      } catch (error) {
        // Handle specific OTP errors - return 400 for client errors
        if (error instanceof OtpNotFoundError) {
          const errorResponse: ErrorResponse = {
            success: false,
            message: "Invalid or expired OTP",
            errors: [],
            correlationId,
          };
          return reply.status(400).send(errorResponse);
        }

        if (error instanceof OtpExpiredError) {
          const errorResponse: ErrorResponse = {
            success: false,
            message: "Invalid or expired OTP",
            errors: [],
            correlationId,
          };
          return reply.status(400).send(errorResponse);
        }

        if (error instanceof InvalidOtpError) {
          const errorResponse: ErrorResponse = {
            success: false,
            message: "Invalid or expired OTP",
            errors: [],
            correlationId,
          };
          return reply.status(400).send(errorResponse);
        }

        // Log unexpected errors
        app.log.error(error);

        // Log error to database for debugging
        const errorDetails = extractErrorDetails(error);
        await logError({
          correlationId,
          email: emailForLogging,
          errorMessage: errorDetails.message,
          errorType: errorDetails.type,
          errorStack: errorDetails.stack,
          requestPath: "/api/otp/verify",
          requestMethod: "POST",
        });

        // Generic error response
        const errorResponse: ErrorResponse = {
          success: false,
          message: "Something went wrong while verifying your OTP. Please try again in a moment.",
          errors: [],
          correlationId,
        };
        return reply.status(500).send(errorResponse);
      }
    }
  );
}
