/**
 * OTP Configuration
 * All values can be overridden via environment variables but by default fallsback to the requirements
 */
export const config = {
  OTP_EXPIRY_SECONDS: parseInt(process.env.OTP_EXPIRY_SECONDS ?? "30", 10),
  OTP_RESEND_WINDOW_MINUTES: parseInt(process.env.OTP_RESEND_WINDOW_MINUTES ?? "5", 10),
  MAX_RESEND_COUNT: parseInt(process.env.MAX_RESEND_COUNT ?? "3", 10),
  MAX_OTP_REQUESTS_PER_HOUR: parseInt(process.env.MAX_OTP_REQUESTS_PER_HOUR ?? "3", 10),
  OTP_UNIQUENESS_WINDOW_HOURS: parseInt(process.env.OTP_UNIQUENESS_WINDOW_HOURS ?? "24", 10),
} as const;
