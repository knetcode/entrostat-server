import { z } from "zod";
import {
  sendOtpSchema,
  resendOtpSchema,
  verifyOtpSchema,
  successResponseSchema as successResponseZodSchema,
  errorResponseSchema as errorResponseZodSchema,
  verifySuccessResponseSchema as verifySuccessResponseZodSchema,
  verifyErrorResponseSchema as verifyErrorResponseZodSchema,
  rateLimitResponseSchema as rateLimitResponseZodSchema,
} from "./otp.schemas";

/**
 * JSON Schema definitions for Fastify/OpenAPI
 * Using Zod v4's native z.toJSONSchema() function
 * @see https://zod.dev/json-schema
 */

// Request body schemas - converted from Zod schemas
export const sendOtpRequestSchema = z.toJSONSchema(sendOtpSchema, {
  target: "openapi-3.0",
});

export const resendOtpRequestSchema = z.toJSONSchema(resendOtpSchema, {
  target: "openapi-3.0",
});

export const verifyOtpRequestSchema = z.toJSONSchema(verifyOtpSchema, {
  target: "openapi-3.0",
});

// Response schemas - converted from Zod schemas
export const successResponseSchema = z.toJSONSchema(successResponseZodSchema, {
  target: "openapi-3.0",
});

export const errorResponseSchema = z.toJSONSchema(errorResponseZodSchema, {
  target: "openapi-3.0",
});

export const verifySuccessResponseSchema = z.toJSONSchema(verifySuccessResponseZodSchema, {
  target: "openapi-3.0",
});

export const verifyErrorResponseSchema = z.toJSONSchema(verifyErrorResponseZodSchema, {
  target: "openapi-3.0",
});

export const rateLimitResponseSchema = z.toJSONSchema(rateLimitResponseZodSchema, {
  target: "openapi-3.0",
});
