/**
 * Integration tests for complete OTP flow
 * Tests the full user journey: send -> verify
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sendOtp, resendOtp, verifyOtp, wait } from "./helpers/api-client";
import { cleanupEmail, getLatestOtpCode } from "./helpers/db-cleanup";

describe("OTP Integration Flow", () => {
  const testEmail = "integration-test@example.com";

  beforeEach(async () => {
    await cleanupEmail(testEmail);
  });

  afterEach(async () => {
    await cleanupEmail(testEmail);
  });

  it("should complete full flow: send -> verify", async () => {
    // Step 1: Send OTP
    const sendResponse = await sendOtp(testEmail);
    expect(sendResponse.status).toBe(200);
    expect(sendResponse.data).toMatchObject({
      success: true,
    });

    // Step 2: Get OTP code (simulating user receiving email)
    await wait(500);
    const otpCode = await getLatestOtpCode(testEmail);
    expect(otpCode).toBeTruthy();
    expect(otpCode?.length).toBe(6);

    // Step 3: Verify OTP
    const verifyResponse = await verifyOtp(testEmail, otpCode!);
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.data).toMatchObject({
      success: true,
      valid: true,
    });
  });

  it("should complete flow with resend: send -> resend -> verify", async () => {
    // Step 1: Send OTP
    await sendOtp(testEmail);
    await wait(500);

    // Step 2: Resend OTP
    const resendResponse = await resendOtp(testEmail);
    expect(resendResponse.status).toBe(200);
    expect(resendResponse.data).toMatchObject({
      success: true,
    });

    // Step 3: Get OTP code (should be same as original)
    await wait(500);
    const otpCode = await getLatestOtpCode(testEmail);
    expect(otpCode).toBeTruthy();

    // Step 4: Verify OTP
    const verifyResponse = await verifyOtp(testEmail, otpCode!);
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.data).toMatchObject({
      valid: true,
    });
  });

  it("should handle flow with multiple resends", async () => {
    // Send OTP
    await sendOtp(testEmail);
    await wait(500);

    // Resend multiple times
    for (let i = 0; i < 2; i++) {
      await resendOtp(testEmail);
      await wait(100);
    }

    // Verify should still work
    const otpCode = await getLatestOtpCode(testEmail);
    expect(otpCode).toBeTruthy();

    const verifyResponse = await verifyOtp(testEmail, otpCode!);
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.data).toMatchObject({
      valid: true,
    });
  });

  it("should reuse same OTP within resend window and only allow single successful verify", async () => {
    // Send first OTP
    await sendOtp(testEmail);
    await wait(500);
    const firstOtp = await getLatestOtpCode(testEmail);
    expect(firstOtp).toBeTruthy();

    // Within resend window, sending again should reuse the same OTP
    await wait(1000);
    await sendOtp(testEmail);
    await wait(500);
    const secondOtp = await getLatestOtpCode(testEmail);
    expect(secondOtp).toBeTruthy();
    expect(secondOtp).toBe(firstOtp);

    // Verify succeeds once
    const verifySuccess = await verifyOtp(testEmail, secondOtp!);
    expect(verifySuccess.data).toMatchObject({ valid: true });

    // Subsequent verify with same code should fail (already used)
    const verifyAgain = await verifyOtp(testEmail, secondOtp!);
    expect(verifyAgain.data).toMatchObject({ success: false });
  });
});
