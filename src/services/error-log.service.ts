import { db } from "../db";
import { errorLogs } from "../db/schema";

/**
 * Error log entry interface
 */
export interface ErrorLogEntry {
  correlationId: string;
  email?: string;
  errorMessage: string;
  errorType?: string;
  errorStack?: string;
  requestPath?: string;
  requestMethod?: string;
}

/**
 * Log an error to the database
 * @param entry - Error log entry details
 * @returns Promise that resolves when error is logged
 */
export async function logError(entry: ErrorLogEntry): Promise<void> {
  try {
    await db.insert(errorLogs).values({
      correlationId: entry.correlationId,
      email: entry.email || null,
      errorMessage: entry.errorMessage,
      errorType: entry.errorType || null,
      errorStack: entry.errorStack || null,
      requestPath: entry.requestPath || null,
      requestMethod: entry.requestMethod || null,
    });
    console.log("[Error Log Service] Error logged:", JSON.stringify(entry, null, 2));
  } catch (error) {
    // Don't throw - we don't want error logging to break the application
    // Just log to console as fallback
    console.error("[Error Log Service] Failed to log error to database:", error);
    console.error("[Error Log Service] Original error:", entry);
  }
}

/**
 * Helper to extract error details from an Error object
 * @param error - Error object
 * @returns Object with error message, type, and stack
 */
export function extractErrorDetails(error: unknown): {
  message: string;
  type?: string;
  stack?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      type: error.name,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
    };
  }

  return {
    message: String(error),
  };
}
