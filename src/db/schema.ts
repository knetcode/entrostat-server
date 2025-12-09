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
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    resendCount: integer("resend_count").default(0).notNull(),
    used: boolean("used").default(false).notNull(),
    invalidated: boolean("invalidated").default(false).notNull(),
  },
  (table) => [index("otp_records_email_idx").on(table.email)]
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
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("otp_history_email_idx").on(table.email)]
);

export type OtpHistory = typeof otpHistory.$inferSelect;
export type NewOtpHistory = typeof otpHistory.$inferInsert;

// Track OTP requests per hour (for rate limiting)
export const otpRateLimit = pgTable(
  "otp_rate_limit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
  },
  (table) => [index("otp_rate_limit_email_idx").on(table.email)]
);

export type OtpRateLimit = typeof otpRateLimit.$inferSelect;
export type NewOtpRateLimit = typeof otpRateLimit.$inferInsert;
