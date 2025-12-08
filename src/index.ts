import Fastify, { FastifyInstance, RouteShorthandOptions } from "fastify";
import { Server, IncomingMessage, ServerResponse } from "http";
import dotenv from "dotenv";
import cors from "@fastify/cors";
import { db } from "./db";
import { pingTable } from "./db/schema";
import { desc } from "drizzle-orm";

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

    // Register routes
    server.get("/ping", opts, async (request, reply) => {
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
