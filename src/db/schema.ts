import { pgTable, serial, varchar, uuid, char, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";

// Ping table (for connectivity testing)
export const pingTable = pgTable("ping", {
  id: serial("id").primaryKey(),
  message: varchar("message", { length: 255 }).notNull(),
});

export type Ping = typeof pingTable.$inferSelect;
export type NewPing = typeof pingTable.$inferInsert;

// Main OTP records table
export const otpRecords = pgTable(
  "otp_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    otpCode: char("otp_code", { length: 6 }).notNull(),
    correlationId: uuid("correlation_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    resendCount: integer("resend_count").default(0).notNull(),
    used: boolean("used").default(false).notNull(),
    invalidated: boolean("invalidated").default(false).notNull(),
  },
  (table) => [
    index("otp_records_email_idx").on(table.email),
    index("otp_records_correlation_id_idx").on(table.correlationId),
  ]
);

export type OtpRecord = typeof otpRecords.$inferSelect;
export type NewOtpRecord = typeof otpRecords.$inferInsert;

// Track OTPs sent in last 24 hours (for uniqueness check)
export const otpHistory = pgTable(
  "otp_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    otpCode: char("otp_code", { length: 6 }).notNull(),
    correlationId: uuid("correlation_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("otp_history_email_idx").on(table.email),
    index("otp_history_correlation_id_idx").on(table.correlationId),
  ]
);

export type OtpHistory = typeof otpHistory.$inferSelect;
export type NewOtpHistory = typeof otpHistory.$inferInsert;

// Track OTP requests per hour (for rate limiting)
export const otpRateLimit = pgTable(
  "otp_rate_limit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    correlationId: uuid("correlation_id"),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
  },
  (table) => [
    index("otp_rate_limit_email_idx").on(table.email),
    index("otp_rate_limit_correlation_id_idx").on(table.correlationId),
  ]
);

export type OtpRateLimit = typeof otpRateLimit.$inferSelect;
export type NewOtpRateLimit = typeof otpRateLimit.$inferInsert;

// Error logs table for tracking errors across user flows
export const errorLogs = pgTable(
  "error_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    correlationId: uuid("correlation_id").notNull(),
    email: varchar("email", { length: 255 }),
    errorMessage: varchar("error_message", { length: 1000 }).notNull(),
    errorType: varchar("error_type", { length: 255 }),
    errorStack: varchar("error_stack", { length: 5000 }),
    requestPath: varchar("request_path", { length: 500 }),
    requestMethod: varchar("request_method", { length: 10 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("error_logs_correlation_id_idx").on(table.correlationId),
    index("error_logs_email_idx").on(table.email),
    index("error_logs_created_at_idx").on(table.createdAt),
  ]
);

export type ErrorLog = typeof errorLogs.$inferSelect;
export type NewErrorLog = typeof errorLogs.$inferInsert;
