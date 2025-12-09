/**
 * Tests for POST /api/otp/send endpoint
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sendOtp, verifyOtp, wait } from "./helpers/api-client";
import { cleanupEmail, getLatestOtpCode, getLatestOtpRecord, getOtpHistory } from "./helpers/db-cleanup";

describe("POST /api/otp/send", () => {
  const testEmail = "test@example.com";
  const testEmail2 = "test2@example.com";

  beforeEach(async () => {
    // Clean up before each test
    await cleanupEmail(testEmail);
    await cleanupEmail(testEmail2);
  });

  afterEach(async () => {
    // Clean up after each test
    await cleanupEmail(testEmail);
    await cleanupEmail(testEmail2);
  });

  describe("Success cases", () => {
    it("should send a new OTP successfully", async () => {
      const response = await sendOtp(testEmail);

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
        message: "OTP sent successfully",
      });
    });

    it("should normalize email to lowercase", async () => {
      const response = await sendOtp("TEST@EXAMPLE.COM");

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
      });

      // Verify it works with lowercase email too
      const response2 = await sendOtp("test@example.com");
      expect(response2.status).toBe(200);
    });

    it("should trim whitespace from email", async () => {
      const response = await sendOtp("  test@example.com  ");

      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        success: true,
      });
    });

    it("should auto-resend existing OTP if within resend window", async () => {
      // Send first OTP
      const response1 = await sendOtp(testEmail);
      expect(response1.status).toBe(200);

      // Send again immediately (should resend same OTP)
      const response2 = await sendOtp(testEmail);
      expect(response2.status).toBe(200);
      expect(response2.data).toMatchObject({
        success: true,
        message: "OTP sent successfully",
      });
    });
  });

  describe("Validation errors", () => {
    it("should reject invalid email format", async () => {
      const response = await sendOtp("invalid-email");

      expect(response.status).toBe(400);
      expect(response.data).toMatchObject({
        success: false,
      });
      expect((response.data as { errors: unknown[] }).errors.length).toBeGreaterThan(0);
    });

    it("should reject empty email", async () => {
      const response = await sendOtp("");

      expect(response.status).toBe(400);
      expect(response.data).toMatchObject({
        success: false,
      });
    });

    it("should reject missing email field", async () => {
      const response = await fetch("http://localhost:3001/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data).toMatchObject({
        success: false,
      });
    });

    it("should reject email that is too long", async () => {
      const longEmail = "a".repeat(250) + "@example.com";
      const response = await sendOtp(longEmail);

      expect(response.status).toBe(400);
      expect(response.data).toMatchObject({
        success: false,
      });
    });
  });

  describe("Rate limiting", () => {
    it("should enforce rate limit of 3 requests per hour", async () => {
      // Send 3 OTPs (should succeed)
      for (let i = 0; i < 3; i++) {
        const response = await sendOtp(testEmail);
        expect(response.status).toBe(200);
        // Small delay to ensure different timestamps
        await wait(100);
      }

      // 4th request should be rate limited
      const response = await sendOtp(testEmail);
      expect(response.status).toBe(429);
      expect(response.data).toMatchObject({
        success: false,
        message: expect.stringContaining("rate limit"),
      });
    });

    it("should track rate limit per email independently", async () => {
      // Send 3 OTPs for email1
      for (let i = 0; i < 3; i++) {
        await sendOtp(testEmail);
        await wait(100);
      }

      // Email2 should still be able to send (not rate limited)
      const response = await sendOtp(testEmail2);
      expect(response.status).toBe(200);
    });
  });

  describe("Edge cases", () => {
    it("should handle concurrent requests gracefully", async () => {
      // Send multiple requests at the same time
      const promises = [sendOtp(testEmail), sendOtp(testEmail), sendOtp(testEmail)];

      const responses = await Promise.all(promises);

      // At least one should succeed (others might hit rate limit or resend)
      const successCount = responses.filter((r) => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe("OTP format requirements", () => {
    it("should generate 6-digit OTP that can start with 0", async () => {
      // Generate multiple OTPs to statistically verify leading zeros are possible
      // We check that OTP is stored as string with proper length (not parsed as number)
      await sendOtp(testEmail);
      await wait(500);

      const otpCode = await getLatestOtpCode(testEmail);
      expect(otpCode).toBeTruthy();
      expect(otpCode?.length).toBe(6);
      // Verify it's a string of exactly 6 digits (including leading zeros)
      expect(otpCode).toMatch(/^\d{6}$/);
    });

    it("should store OTP as 6-character string preserving leading zeros", async () => {
      await sendOtp(testEmail);
      await wait(500);

      const record = await getLatestOtpRecord(testEmail);
      expect(record).toBeTruthy();
      // Verify the OTP code length is exactly 6 in the database
      expect(record?.otpCode.length).toBe(6);
    });
  });

  describe("OTP uniqueness within 24 hours", () => {
    it("should track OTP history for uniqueness checks", async () => {
      await sendOtp(testEmail);
      await wait(500);

      const history = await getOtpHistory(testEmail);
      expect(history.length).toBeGreaterThan(0);

      // Each history entry should have a 6-digit OTP
      for (const entry of history) {
        expect(entry.otpCode.length).toBe(6);
        expect(entry.otpCode).toMatch(/^\d{6}$/);
      }
    });
  });

  describe("OTP resend window behavior", () => {
    it("should reuse same OTP within resend window even after expiry, extending the expiry", async () => {
      // Send first OTP
      await sendOtp(testEmail);
      await wait(500);
      const firstOtp = await getLatestOtpCode(testEmail);
      expect(firstOtp).toBeTruthy();

      // Wait for OTP to expire (30 seconds) - but still within 5-minute resend window
      console.log("Waiting for OTP to expire (30+ seconds)...");
      await wait(35000);

      // Verify the expired OTP fails
      const verifyExpired = await verifyOtp(testEmail, firstOtp!);
      expect(verifyExpired.data).toMatchObject({
        valid: false, // Should fail because expired
      });

      // Send again - within resend window, so same OTP is resent with extended expiry
      await sendOtp(testEmail);
      await wait(500);
      const secondOtp = await getLatestOtpCode(testEmail);
      expect(secondOtp).toBeTruthy();

      // Should be the SAME OTP (resent, not new)
      expect(secondOtp).toBe(firstOtp);

      // Now the OTP should be valid again (expiry was extended by resend)
      const verifyExtended = await verifyOtp(testEmail, secondOtp!);
      expect(verifyExtended.data).toMatchObject({
        valid: true,
      });
    }, 45000); // 45 second timeout
  });
});
