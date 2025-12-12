# OTP Server

Fastify API server for OTP generation, resending, and verification.

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp env.example .env
# Edit .env with your values

# Run migrations (if needed)
pnpm drizzle-kit push

# Start server in dev mode
pnpm dev
```

## Helpers for running Docker locally

```bash
make build  # Build Docker image
make start  # Start container
```

## Environment Variables

See `env.example` for required variables:

- `DATABASE_URL` - PostgreSQL connection string
- `RESEND_API_KEY` - Resend API key for email delivery
- `EMAIL_FROM` - Sender email address
- `SKIP_EMAIL=true` - Skip email sending (useful for local dev/testing)

## Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm test` - Run test suite
- `pnpm test:watch` - Run tests in watch mode

## API Endpoints

- `POST /api/otp/send` - Request new OTP
- `POST /api/otp/resend` - Resend existing OTP
- `POST /api/otp/verify` - Verify OTP code
- `GET /api/openapi.json` - OpenAPI specification
- `GET /docs` - Swagger UI documentation
