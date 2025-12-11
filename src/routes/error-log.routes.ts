import { FastifyInstance } from "fastify";
import { z } from "zod";
import { logError } from "../services/error-log.service";

/**
 * Schema for error log request
 */
const errorLogSchema = z.object({
  correlationId: z.string().uuid(),
  email: z.string().email().optional(),
  errorMessage: z.string().min(1).max(1000),
  errorType: z.string().max(255).optional(),
  errorStack: z.string().max(5000).optional(),
  requestPath: z.string().max(500).optional(),
  requestMethod: z.string().max(10).optional(),
});

/**
 * Register error log routes with Fastify instance
 * @param app - Fastify instance
 */
export async function errorLogRoutes(app: FastifyInstance) {
  /**
   * POST /api/error-log
   * Log an error for debugging and production support
   */
  app.post(
    "/api/error-log",
    {
      schema: {
        description: "Log an error for debugging and production support",
        tags: ["Error Log"],
        body: {
          type: "object",
          required: ["correlationId", "errorMessage"],
          properties: {
            correlationId: { type: "string", format: "uuid" },
            email: { type: "string", format: "email" },
            errorMessage: { type: "string", maxLength: 1000 },
            errorType: { type: "string", maxLength: 255 },
            errorStack: { type: "string", maxLength: 5000 },
            requestPath: { type: "string", maxLength: 500 },
            requestMethod: { type: "string", maxLength: 10 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const validationResult = errorLogSchema.safeParse(request.body);

        if (!validationResult.success) {
          return reply.status(400).send({
            success: false,
            message: "Invalid error log data",
          });
        }

        await logError(validationResult.data);

        return reply.status(200).send({
          success: true,
          message: "Error logged successfully",
        });
      } catch (error) {
        app.log.error(error);
        // Don't fail the error logging endpoint itself
        return reply.status(200).send({
          success: true,
          message: "Error logged (with potential issues)",
        });
      }
    }
  );
}
