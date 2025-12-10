import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

/**
 * Email service using Resend API
 * https://resend.com/docs/send-with-nodejs
 */

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Email configuration from environment variables
 */
const emailConfig = {
  fromEmail: process.env.EMAIL_FROM!,
  fromName: process.env.EMAIL_FROM_NAME,
};

/**
 * Send OTP email to user
 * @param email - Recipient email address
 * @param otp - OTP code to send
 * @returns Promise with send result
 * @throws Error if email fails to send
 */
export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  /**
   * When running automated tests or local smoke tests we don't want to hit the real
   * Resend API (it rate limits at 2 req/s and will 429 quickly). If SKIP_EMAIL is
   * set, we'll short-circuit and pretend the email was sent. This keeps endpoint
   * behaviour intact while avoiding external dependency flakiness.
   */
  if (process.env.SKIP_EMAIL === "true") {
    // Pretend success during tests/local runs to avoid rate limits
    console.log(`[Email Service] SKIP_EMAIL enabled, not sending email to ${email} | OTP: ${otp}`);
    return;
  }

  const { data, error } = await resend.emails.send({
    from: emailConfig.fromEmail,
    to: [email],
    subject: "Your One-Time Password (OTP)",
    html: generateOtpEmailHtml(otp),
    text: generateOtpEmailText(otp),
  });

  if (error) {
    console.error("[Email Service] Failed to send OTP email:", error);
    throw new Error(`Failed to send OTP email: ${error.message}`);
  }

  // Log success (mask OTP for security)
  console.log(`[Email Service] OTP email sent to ${email}, messageId: ${data?.id}`);
}

/**
 * Generate HTML content for OTP email
 * @param otp - OTP code to include in email
 * @returns HTML string for email body
 */
function generateOtpEmailHtml(otp: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your OTP Code</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px; text-align: center;">Your One-Time Password</h1>
        </div>
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e0e0e0; border-top: none;">
          <p style="margin: 0 0 20px 0;">Hello,</p>
          <p style="margin: 0 0 20px 0;">Your one-time password (OTP) is:</p>
          <div style="background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea;">${otp}</span>
          </div>
          <p style="margin: 20px 0; color: #666; font-size: 14px;">
            ⏱️ This code will expire in <strong>30 seconds</strong>.
          </p>
          <p style="margin: 20px 0; color: #666; font-size: 14px;">
            If you didn't request this code, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
          <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
            This is an automated message. Please do not reply to this email.
          </p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate plain text content for OTP email
 * @param otp - OTP code to include in email
 * @returns Plain text string for email body
 */
function generateOtpEmailText(otp: string): string {
  return `
Your One-Time Password (OTP)

Hello,

Your one-time password (OTP) is: ${otp}

This code will expire in 30 seconds.

If you didn't request this code, please ignore this email.

---
This is an automated message. Please do not reply to this email.
  `.trim();
}
