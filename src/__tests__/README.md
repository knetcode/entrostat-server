# OTP API Test Suite

Comprehensive test suite for the OTP security system API endpoints.

## Prerequisites

1. **Server must be running** on `http://localhost:3001`
  ```bash
  # In server directory
  make build \ 
  make start   
  ```

2. **Database must be accessible** - Tests need database access for:
   - Cleaning up test data between tests
   - Retrieving OTP codes for verification tests

3. **Environment variables** - Ensure your `.env` file has:
   - `DATABASE_URL` - PostgreSQL connection string
   - `RESEND_API_KEY` - Resend API key (for email sending)
   - `EMAIL_FROM` - Email address for sending OTPs
   - `SKIP_EMAIL=true` - Set during tests to avoid Resend rate limits (recommended)

## Running Tests

### Run all tests once
```bash
pnpm test
```

### Run tests in watch mode (for development)
```bash
pnpm test:watch
```

### Run tests with UI (interactive)
```bash
pnpm test:ui
```

### Run specific test file
```bash
pnpm test otp.send.test.ts
```

## Test Structure

### Test Files

- **`otp.send.test.ts`** - Tests for `POST /api/otp/send`
  - Success cases (new OTP, email normalization)
  - Validation errors (invalid email, missing fields)
  - Rate limiting (3 requests/hour)
  - Edge cases (concurrent requests)

- **`otp.resend.test.ts`** - Tests for `POST /api/otp/resend`
  - Success cases (resend existing OTP, multiple resends)
  - Error cases (no OTP found, expired window, max resends exceeded)
  - Validation errors

- **`otp.verify.test.ts`** - Tests for `POST /api/otp/verify`
  - Success cases (correct OTP, email normalization)
  - Error cases (invalid OTP, expired OTP, already used)
  - Validation errors (wrong format, missing fields)

- **`otp.integration.test.ts`** - Integration tests
  - Full flow: send → verify
  - Flow with resend: send → resend → verify
  - Multiple resends flow
  - New OTP after resend window

### Helper Files

- **`helpers/api-client.ts`** - HTTP client for making API requests
- **`helpers/db-cleanup.ts`** - Database utilities for test isolation

## Test Coverage

The test suite covers all backend requirements:

✅ **Send OTP Endpoint**
- Valid requests
- Email normalization (lowercase, trim)
- Auto-resend within window
- Invalid email formats
- Rate limiting (3/hour)
- Concurrent requests
- OTP format: 6 digits with leading zeros preserved
- OTP history tracking for uniqueness
- Old OTP invalidation when new OTP generated

✅ **Resend OTP Endpoint**
- Valid resends
- Multiple resends (up to max)
- No OTP found
- Resend window expired
- Max resends exceeded
- Invalidated OTPs
- **Expiry time extension on resend**
- **OTP remains valid after resend extends expiry**

✅ **Verify OTP Endpoint**
- Valid verification
- Invalid OTP codes
- Expired OTPs (30 second expiry)
- Already used OTPs
- No active OTP found
- Invalid formats
- **Only latest OTP is valid** (old OTPs invalidated)

✅ **Integration Flows**
- Complete send → verify flow
- Send → resend → verify flow
- Multiple resends → verify
- New OTP invalidates old OTP

### Requirements Mapping

| Requirement | Test File | Test Name |
|-------------|-----------|-----------|
| OTP is 6 digits, can start with 0 | `otp.send.test.ts` | "OTP format requirements" suite |
| No duplicate OTP within 24 hours | `otp.send.test.ts` | "OTP uniqueness within 24 hours" suite |
| Max 3 OTPs per hour | `otp.send.test.ts` | "Rate limiting" suite |
| Only latest OTP valid | `otp.verify.test.ts` | "Only latest OTP is valid" suite |
| OTP expires after 30 seconds | `otp.verify.test.ts` | "should reject expired OTP" |
| Resend within 5 min reuses OTP | `otp.send.test.ts` | "should auto-resend existing OTP" |
| Resend updates/extends expiry | `otp.resend.test.ts` | "should update expiry time when OTP is resent" |
| Resend extends expired OTP | `otp.send.test.ts` | "OTP resend window behavior" suite |
| Max 3 resends | `otp.resend.test.ts` | "should reject resend when max resend count exceeded" |
| OTP can only be used once | `otp.verify.test.ts` | "should reject already used OTP" |

### Important Behavior Notes

- **Resend window (5 min) vs Expiry (30 sec)**: The resend window is longer than the expiry. 
  If an OTP expires but is still within the resend window, calling send again will **resend the same OTP 
  with an extended expiry** rather than generate a new one.
- **Invalidation**: Old OTPs are only invalidated when a truly NEW OTP is generated (outside the resend window 
  or when resend count is exceeded).

## Test Isolation

Tests are isolated using:
- **BeforeEach/AfterEach hooks** - Clean up test data
- **Unique test emails** - Each test file uses different email addresses
- **Database cleanup** - Removes OTP records, history, and rate limit entries

## Notes

- **OTP Expiry Test**: The expired OTP test waits 35 seconds, so it has a longer timeout
- **Rate Limiting**: Rate limit tests may interfere with each other if run in parallel - consider running sequentially for rate limit tests
- **Database Access**: Tests require direct database access for cleanup and OTP retrieval
- **Server URL**: Can be configured via `TEST_SERVER_URL` environment variable (defaults to `http://localhost:3001`)

## Troubleshooting

### Tests failing with "Connection refused"
- Ensure the server is running on `http://localhost:3001`
- Check that CORS is properly configured

### Tests failing with 500 errors on send/resend/verify
- Make sure `SKIP_EMAIL=true` is set so Resend is not called during tests
- Restart the server after changing the environment variable

### Database connection errors
- Verify `DATABASE_URL` is set correctly
- Ensure PostgreSQL is running and accessible

### Rate limit tests failing
- Rate limits persist across test runs if not cleaned up
- Ensure cleanup functions are working correctly
- Consider resetting rate limit table between test suites

### OTP expiry tests timing out
- These tests wait for OTPs to expire (30+ seconds)
- Timeout is set to 40 seconds for expiry tests
- If tests are slow, consider using a test database with shorter expiry times
