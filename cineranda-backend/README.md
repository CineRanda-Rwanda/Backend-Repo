# Cineranda Backend

Cineranda is a full-featured OTT/VOD backend built with TypeScript, Express, and MongoDB. It powers movie and series management, wallet-based purchases, multi-gateway payments, watch history, notifications, analytics, and rich admin tooling. This README explains every moving part so a new contributor can clone the repo, configure dependencies, and be productive without guesswork.

## Table of Contents
1. [Key Features](#key-features)
2. [Tech Stack](#tech-stack)
3. [Architecture Overview](#architecture-overview)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Environment Configuration](#environment-configuration)
7. [Installation & Setup](#installation--setup)
8. [Running the Application](#running-the-application)
9. [Available NPM Scripts](#available-npm-scripts)
10. [Testing Strategy](#testing-strategy)
11. [Database & Seed Data](#database--seed-data)
12. [Core Domains & Modules](#core-domains--modules)
13. [External Integrations](#external-integrations)
14. [Coding Standards & Tooling](#coding-standards--tooling)
15. [Deployment Notes](#deployment-notes)
16. [Troubleshooting](#troubleshooting)
17. [Further Reading](#further-reading)

---

## Key Features
- **Authentication & Authorization**: JWT-based auth with refresh tokens, PIN management, 2FA, and role-based guards (`user`, `admin`).
- **Content Platform**: Rich CRUD for movies and series, episode pricing, media uploads to S3, signed streaming URLs, featured content, search & filtering.
- **Wallet & Payments**: Unified RWF wallet, welcome bonuses, manual adjustments, and payment flows via Stripe, PayPal, Flutterwave, MTN MoMo, Airtel Money.
- **Purchasing & Access Control**: Purchase movies, seasons, or episodes; secure playback via middleware that checks ownership, publication status, and free tiers.
- **Ratings & Reviews**: Content-level ratings with per-title toggles, moderation endpoints, and aggregated stats.
- **User Activity**: Favorites, watch history, watch-progress tracking, unlocked library view, notifications system.
- **Admin Toolkit**: Advanced analytics dashboards, notifications broadcaster, settings management, default admin seeder.
- **Observability & Security**: Helmet, CORS, structured logging, request tracing, centralized error handling, location detection middleware.

## Tech Stack
- **Language**: TypeScript (ES2018 target)
- **Runtime / Framework**: Node.js 18+, Express 5
- **Database**: MongoDB (+ MongoMemoryServer for tests)
- **Object Modeling**: Mongoose 8
- **Storage**: AWS S3 (uploads via `@aws-sdk/client-s3` & `multer-s3`)
- **Auth**: JWT, bcrypt, speakeasy (2FA)
- **Payments**: Stripe, PayPal SDK, Flutterwave, MTN MoMo, Airtel Money
- **Testing**: Jest, ts-jest, Supertest
- **Tooling**: Nodemon, ts-node, TypeScript paths, Winston logging

## Architecture Overview
The backend follows a layered architecture:

1. **Routes (`src/api/routes`)** bind HTTP paths to controllers and apply middleware.
2. **Controllers (`src/api/controllers`)** handle request validation, orchestrate services, and shape responses.
3. **Services (`src/core/services`)** encapsulate business logic (auth, payments, storage, verification, etc.).
4. **Repositories (`src/data/repositories`)** wrap Mongoose models for query composition and reuse.
5. **Models (`src/data/models`)** define MongoDB schemas for content, users, payments, etc.
6. **Middleware (`src/middleware`)** handles auth, logging, access control, uploads, geolocation, and global error handling.
7. **Utilities (`src/utils`)** host shared helpers (pricing, errors, etc.).

Data flow example for “watch a purchased movie”:
`Route -> authenticate middleware -> contentAccess middleware -> ContentController.getWatchContent -> S3Service signs media URLs -> response sent with temporary playback links.`

## Project Structure
```
src/
  app.ts                 # Express app bootstrap
  server.ts              # Entry point (connects DB & starts server)
  config/                # Environment & provider config
  api/
    routes/              # Route definitions (auth, content, admin, etc.)
    controllers/         # Request handlers per domain
  core/services/         # Auth, movie, payment, S3, verification, WhatsApp
  data/
    databaseConnection.ts
    models/              # Mongoose schemas (users, content, purchases...)
    repositories/        # Data access abstractions
    seeders/             # Admin seeder
  middleware/            # Auth, access control, uploads, error handler
  scripts/               # Utility scripts (price migrations, etc.)
  utils/                 # AppError, pricing helpers, etc.

config files: tsconfig.json, jest.config.js, jest.setup.js
tests/
  setup.ts               # MongoMemoryServer bootstrap
  unit/                  # Unit tests
  integration/           # Supertest suites (auth, content, payment, admin)
```

## Prerequisites
Ensure the following are available on your machine or CI runner:
- **Node.js** v18 or later (LTS recommended)
- **npm** v9+ (ships with Node 18)
- **MongoDB** server (local or remote). Tests use an in-memory instance and do not require a running MongoDB.
- **AWS S3 bucket** and IAM credentials with put/get/delete permissions.
- **Payment credentials** (test keys are fine) for Stripe, PayPal, Flutterwave, MTN MoMo, Airtel Money, depending on the flows you need.
- **Git** for version control.

Optional but recommended:
- Docker (if you plan to containerize)
- An HTTPS tunneling tool (ngrok) when testing payment webhooks locally.

## Environment Configuration
Copy `.env.example` to `.env` in the repo root and fill in the required values.

```bash
cp .env.example .env
```

### Mandatory Variables
| Category | Variables |
| --- | --- |
| Server | `NODE_ENV`, `PORT`, `API_PREFIX` |
| Database | `MONGODB_URI` |
| JWT | `JWT_SECRET`, `JWT_EXPIRATION`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRATION` |
| AWS S3 | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` |
| Admin bootstrap | `ADMIN_EMAIL`, `ADMIN_PASSWORD` |
| Client | `CLIENT_URL` (used for redirect links) |

### Payments & Integrations
- **Stripe**: `STRIPE_SECRET_KEY`
- **PayPal**: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`
- **Flutterwave**: `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_ENCRYPTION_KEY`, `FLUTTERWAVE_SECRET_HASH`
- **MTN MoMo**: `MTN_MOMO_API_KEY`
- **Airtel Money**: `AIRTEL_MONEY_API_KEY`
- **General callbacks**: `PAYMENT_CALLBACK_URL`, `PAYMENT_WEBHOOK_URL`

> **Note:** `.env.example` still uses `JWT_EXPIRE` naming. The runtime config (`src/config/index.ts`) expects `JWT_EXPIRATION` & `JWT_REFRESH_EXPIRATION`. Keep the config file naming to avoid undefined errors.

## Installation & Setup
1. **Clone the repository**
   ```bash
   git clone https://github.com/<org>/cineranda-backend.git
   cd cineranda-backend
   ```
2. **Install dependencies**
   ```bash
   npm install
   ```
3. **Provision infrastructure**
   - Create an S3 bucket and note the region and name.
   - Create/test payment sandbox accounts as needed.
   - Ensure your MongoDB instance is reachable from your machine.
4. **Configure environment**
   - Fill in `.env` using the instructions above.
   - Optional: export environment variables via your shell or a secret manager.
5. **(Optional) Configure TypeScript path aliases**
   - `tsconfig.json` defines `@/*` -> `src/*`. Most IDEs pick this up automatically; if not, configure your editor.

## Running the Application
### Development Mode
```bash
npm run dev
```
- Uses `nodemon` + `ts-node` to compile on the fly.
- Automatically reloads on file changes.
- Prints server URL and API prefix on startup.

### Production Build
```bash
npm run build   # Compiles TypeScript to dist/
npm start       # Runs node dist/server.js
```
Ensure `.env` is available in the runtime environment (or inject vars via your process manager).

### Health Check
Once running, verify the service via:
```
GET http://localhost:<PORT>/health -> { "status": "ok" }
```

## Available NPM Scripts
| Script | Description |
| --- | --- |
| `npm run dev` | Start development server with live reload | 
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server (`dist/server.js`) |
| `npm test` | Execute all Jest tests (unit + integration) |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run seed:admin` | Create a default admin user (see [Database & Seed Data](#database--seed-data)) |

## Testing Strategy
- **Framework**: Jest with `ts-jest` transform.
- **Environment**: Node.js (`testEnvironment: 'node'`).
- **Setup Files**: `jest.setup.js` (global config) and `tests/setup.ts` (MongoMemoryServer bootstrap).
- **Test Suites**:
  - `tests/integration/*.test.ts`: Supertest-powered API suites for auth, content, payments, etc.
  - `tests/unit/*.test.ts`: Focused unit tests.
- **In-Memory MongoDB**: Tests spin up `mongodb-memory-server` (v7.0.24 binary). The first run downloads the binary into `./mongodb-binaries`.
- **Timeouts**: Jest timeout is increased to 60s to accommodate hashing/Mongo startup.

### Running Tests
```bash
npm test              # full suite
npm run test:watch    # during development
npm run test:coverage # coverage summary in console + coverage/
```

> If tests hang on startup, delete `mongodb-binaries` and rerun to redownload the binary.

## Database & Seed Data
- **Connection**: Defined in `src/data/databaseConnection.ts`. Defaults to `mongodb://localhost:27017/cineranda-dev` when no env var is provided.
- **Disconnection**: Tests call `disconnect()` automatically during teardown.
- **Seeding**: Run `npm run seed:admin` to create a default admin user (`src/data/seeders/adminSeeder.ts`). Update the seed file or env values before running in production.

## Core Domains & Modules
### Authentication (`src/api/controllers/auth.controller.ts`)
- Registration flow with phone verification.
- Login + token issuance, refresh tokens for admins.
- Password & PIN management, 2FA (speakeasy).
- Profile endpoints for authenticated users.

### Users (`src/api/controllers/user.controller.ts`)
- Admin-only CRUD, role changes, balance adjustments, transaction history.

### Content (`src/api/controllers/content.controller.ts`)
- Manage movies, series, seasons, episodes.
- Uploads via `multer-s3` and `S3Service`.
- Signed URLs for playback, trailer endpoints for public access.
- Access control enforced by `contentAccess.middleware.ts`.

### Payments & Wallet (`src/api/controllers/payment.controller.ts`)
- Wallet top-ups, RWF balance tracking (balance + bonus balance).
- Purchase flows for content, seasons, episodes via wallet or gateway.
- Payment callbacks & webhooks for asynchronous providers.

### Ratings (`src/api/controllers/rating.controller.ts`)
- Submit/update/delete ratings, toggle rating availability per content.

### Activity Modules
- **Favorites** (`favorite.controller.ts`)
- **Watch History** (`watchHistory.controller.ts`)
- **Watch Progress** (`watchProgress.controller.ts`)
- **Unlocked Library** (`content.controller.ts#getUnlockedContent`)
- **Notifications** (`notification.controller.ts`)

### Analytics (`src/api/controllers/analytics.controller.ts`)
- Admin dashboards for revenue, user growth, content performance, wallet stats, platform health.

### Middleware Highlights
- `auth.middleware.ts`: `authenticate`, `authorize`, `restrictToAdmin`.
- `contentAccess.middleware.ts`: Ensures only published content is accessed unless requester is admin.
- `upload.middleware.ts`: Handles multi-part uploads to S3.
- `errorHandler.ts`: Centralized error normalization using `AppError`.
- `requestLogger.ts`: Logs method/path/status via Winston.
- `location.middleware.ts`: Adds geolocation metadata to requests.

## External Integrations
| Integration | Purpose | Configuration |
| --- | --- | --- |
| AWS S3 | Poster images, videos, subtitles | `AWS_*` env vars in `.env` |
| Stripe / PayPal | Card payments | Keys under `payment.stripe` / `payment.paypal` in config |
| Flutterwave | Mobile money & card payments | `FLUTTERWAVE_*` env vars |
| MTN MoMo & Airtel Money | Regional mobile money | `MTN_MOMO_API_KEY`, `AIRTEL_MONEY_API_KEY` |
| WhatsApp Service | User notifications | Implemented inside `src/core/services/whatsapp.service.ts` |

> Most third-party SDKs expect test credentials in development. Never commit real secrets.

## Coding Standards & Tooling
- **Language Rules**: Strict TypeScript (`"strict": true`).
- **Path Aliases**: Use `@/` prefix to import from `src/`.
- **Linting**: No dedicated ESLint config is included; follow established code style (2-space indentation, descriptive logging, minimal inline comments).
- **Error Handling**: Throw `AppError` for user-facing issues; unhandled errors bubble to `errorHandler`.
- **Logging**: Use the provided Winston logger utilities or `requestLogger` for HTTP traces.

## Deployment Notes
1. **Build** the project: `npm run build`.
2. Ensure `.env` values are provided via environment variables, secret managers, or `.env` files on the server.
3. **Assets Storage**: Production deployments must have access to the configured S3 bucket. Replace any local file uploads.
4. **SSL / Reverse Proxy**: Run the Node process behind a reverse proxy (NGINX, API Gateway, etc.) for TLS termination.
5. **Process Manager**: Use PM2, systemd, or Docker to keep the service running and handle restarts.
6. **Webhooks**: Expose public HTTPS endpoints for payment callbacks; update `PAYMENT_CALLBACK_URL` / `PAYMENT_WEBHOOK_URL` accordingly.
7. **Monitoring**: Aggregate logs and set up alerts for `unhandledRejection`/`uncaughtException`.

## Troubleshooting
| Symptom | Possible Cause | Fix |
| --- | --- | --- |
| Server exits immediately | Missing env vars (e.g., JWT secrets) | Check `.env` or console error logs |
| Unable to upload media | Incorrect AWS credentials or bucket policy | Validate IAM permissions (`s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`) |
| Payment callbacks fail | Local server not publicly reachable | Use ngrok and update webhook URLs |
| Tests hang on startup | MongoMemory binary missing/corrupted | Delete `mongodb-binaries` and rerun `npm test` |
| Admin routes return 403 | Missing `restrictToAdmin` middleware or token lacks admin role | Re-login with admin credentials |
| Signed URLs expired quickly | Default TTL is 2h for videos, 24h for images/subtitles | Adjust TTL in `ContentController.signContentUrls` if needed |

## Further Reading
- `BACKEND_CHANGES_REQUIRED.md`: Detailed product roadmap & acceptance criteria.
- `tests/README.md`: Additional notes specific to the test suite.
- Payment provider docs (Stripe, PayPal, Flutterwave) for webhook payload formats.

---

Happy hacking! If you improve the backend or run into issues that the README does not cover, please document the findings so the next engineer has an even smoother onboarding.
