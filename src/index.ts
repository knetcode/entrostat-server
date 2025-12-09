import Fastify, { FastifyInstance, RouteShorthandOptions } from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";
import dotenv from "dotenv";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { db } from "./db";
import { pingTable } from "./db/schema";
import { desc } from "drizzle-orm";
import { otpRoutes } from "./routes/otp.routes";

dotenv.config();

const DEFAULT_PORT = 3001;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;

const server: FastifyInstance<Server, IncomingMessage, ServerResponse> = Fastify({});

const opts: RouteShorthandOptions = {
  schema: {
    response: {
      200: {
        type: "object",
        properties: {
          pong: {
            type: "string",
          },
        },
      },
    },
  },
};

async function start() {
  try {
    // Register CORS plugin
    await server.register(cors, {
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    });

    // Register Swagger for OpenAPI documentation
    await server.register(swagger, {
      openapi: {
        openapi: "3.1.0",
        info: {
          title: "OTP Security System API",
          description: "API for requesting, resending, and verifying OTPs",
          version: "1.0.0",
        },
        servers: [
          {
            url: process.env.SERVER_URL || `http://localhost:${PORT}`,
            description: "Development server",
          },
        ],
        tags: [
          {
            name: "OTP",
            description: "One-Time Password operations",
          },
        ],
      },
    });

    // Register Swagger UI
    await server.register(swaggerUi, {
      routePrefix: "/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: false,
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
    });

    // Custom error handler for validation errors
    server.setErrorHandler((error, request, reply) => {
      // Type guard for validation errors
      const hasValidation = typeof error === "object" && error !== null && "validation" in error;

      // Handle Fastify validation errors
      // Allowing `any` because we don't always know what type the error will be.
      if (hasValidation && Array.isArray((error as any).validation)) {
        const validationError = error as any;
        return reply.status(400).send({
          success: false,
          message: validationError.message || "Validation error",
          errors: validationError.validation.map((err: any) => ({
            code: err.keyword || "validation_error",
            path: err.instancePath ? err.instancePath.split("/").filter(Boolean) : [],
            message: err.message || "Validation failed",
          })),
        });
      }

      // Log unexpected errors
      server.log.error(error);

      // Generic error response
      const errorObj = error as any;
      const statusCode = typeof errorObj.statusCode === "number" ? errorObj.statusCode : 500;
      const message = error instanceof Error ? error.message : "An unexpected error occurred";

      return reply.status(statusCode).send({
        success: false,
        message,
        errors: [],
      });
    });

    // Register test route
    server.get("/ping", opts, async (_request, reply) => {
      try {
        const result = await db.select().from(pingTable).orderBy(desc(pingTable.id)).limit(1);

        if (result.length === 0) {
          return { pong: "No entries found in ping table" };
        }

        return { pong: result[0].message };
      } catch (error) {
        server.log.error(error);
        reply.code(500);
        return { pong: "Database error occurred" };
      }
    });

    // Register OTP routes
    await server.register(otpRoutes);

    // Export OpenAPI spec as JSON
    server.get("/api/openapi.json", async (_request, reply) => {
      return reply.send(server.swagger());
    });

    await server.listen({ port: PORT, host: "0.0.0.0" });

    const address = server.server.address();
    const serverPort = typeof address === "string" ? address : address?.port;

    console.log(`Server listening on port ${serverPort}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
