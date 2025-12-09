CREATE TABLE "otp_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"otp_code" char(6) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_rate_limit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"otp_code" char(6) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"resend_count" integer DEFAULT 0 NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"invalidated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ping" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "otp_history_email_idx" ON "otp_history" USING btree ("email");--> statement-breakpoint
CREATE INDEX "otp_rate_limit_email_idx" ON "otp_rate_limit" USING btree ("email");--> statement-breakpoint
CREATE INDEX "otp_records_email_idx" ON "otp_records" USING btree ("email");