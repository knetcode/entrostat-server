import { pgTable, serial, varchar } from "drizzle-orm/pg-core";

export const pingTable = pgTable("ping", {
  id: serial("id").primaryKey(),
  message: varchar("message", { length: 255 }).notNull(),
});

export type Ping = typeof pingTable.$inferSelect;
export type NewPing = typeof pingTable.$inferInsert;
