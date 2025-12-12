# Backend Test Suite

Vitest tests for OTP API endpoints.

## Prerequisites

- Server running on `http://localhost:3001` (via `make build ; make start` or `pnpm build ; pnpm start`)
- Database accessible via `DATABASE_URL`
- `SKIP_EMAIL=true` in `.env` (recommended for tests)

## Running Tests

```bash
pnpm test              # Run once
pnpm test:watch        # Watch mode
pnpm test:ui           # Interactive UI
```

## Test Files

- `otp.send.test.ts` - Send OTP endpoint (rate limiting, validation, auto-resend)
- `otp.resend.test.ts` - Resend OTP endpoint (window, max resends, expiry extension)
- `otp.verify.test.ts` - Verify OTP endpoint (valid/invalid, expired, used)
- `otp.integration.test.ts` - Full flow tests (send → verify, resend flows)

## Helpers

- `helpers/api-client.ts` - HTTP client for API requests
- `helpers/db-cleanup.ts` - Database cleanup utilities

## Test Isolation

Tests use unique email addresses and cleanup data in `beforeEach`/`afterEach` hooks.
