/**
 * API Client for testing OTP endpoints
 * Makes HTTP requests to the running server at http://localhost:3001
 */

const BASE_URL = process.env.TEST_SERVER_URL || "http://localhost:3001";

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
}

/**
 * Make a POST request to an endpoint
 */
async function post<T = unknown>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as T;

  return {
    status: response.status,
    data,
  };
}

/**
 * Send OTP request
 */
export async function sendOtp(email: string) {
  return post("/api/otp/send", { email });
}

/**
 * Resend OTP request
 */
export async function resendOtp(email: string) {
  return post("/api/otp/resend", { email });
}

/**
 * Verify OTP request
 */
export async function verifyOtp(email: string, otp: string) {
  return post("/api/otp/verify", { email, otp });
}

/**
 * Wait for a specified number of milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
