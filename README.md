# School Office API

A focused backend demo for Credosis Phase 02: student records and fee tracking with staff permissions. TypeScript, Express 5, PostgreSQL, Prisma 7, Zod, Vitest/Supertest, and Swagger UI. No actual money moves.

Source: [Sarah-Metwaly/school-office-api](https://github.com/Sarah-Metwaly/school-office-api). The [video narration transcript](docs/VIDEO_TRANSCRIPT.md) explains the demo's workflow and transaction safeguards.

## Run from a clean checkout

Prerequisites: Node.js **22.12+ within 22.x**, or Node.js 24 LTS; npm; Docker Desktop running. Node 22.18.0 was used for verification. Prisma 7 uses the PostgreSQL driver adapter. The lockfile pins the tested dependency versions.

```powershell
npm ci
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Put the generated value in `.env` as `JWT_SECRET`. The supplied URL targets the dedicated Docker database on port 5433. If that port is occupied, change both `compose.yaml` and `.env`; do not reuse an unrelated database.

```powershell
docker compose up -d --wait
npm run generate
npm run db:migrate
npm run db:seed
npm run typecheck
npm test
npm run build
npm start
```

Open [Swagger UI](http://localhost:3000/docs), [OpenAPI JSON](http://localhost:3000/openapi.json), or [health](http://localhost:3000/health). `npm run dev` runs the TypeScript development server. The server binds to loopback only. `docker compose stop` stops the database without removing its data.

**Without Docker:** provision a new dedicated PostgreSQL database (tested with PostgreSQL 18), set its connection URL in `.env`, and run the commands from `npm run generate` onward. No global PostgreSQL settings need changing. The current machine's isolated temporary cluster is described in the untracked `LOCAL_SETUP.md`.

`/health` queries the database: 200 means available; 503 means unavailable. Missing environment variables fail startup and name the invalid variables without displaying their values.

## Local demonstration accounts and records

These credentials are for fictional local demonstration only. The seed reads their passwords from `.env`, hashes them with bcrypt (cost 12), and updates the two accounts on reruns. It creates missing demo students with initial ledgers and preserves existing student/payment history. Do not use this seed or these credentials in production.

| Account | Password in `.env.example` | Permissions |
| --- | --- | --- |
| `admin@school.demo` | `AdminDemo123!` | Read and write |
| `reader@school.demo` | `ReaderDemo123!` | Read only |

| Fictional student | ID | Charges | Paid | Outstanding |
| --- | --- | --- | --- | --- |
| Mariam Demo | `11111111-1111-4111-8111-111111111111` | EGP 1,500 | EGP 500 | EGP 1,000 |
| Omar Example | `22222222-2222-4222-8222-222222222222` | EGP 1,200 | EGP 1,200 | EGP 0 |
| Nour Sample | `33333333-3333-4333-8333-333333333333` | EGP 900 | EGP 0 | EGP 900 |

Amounts above describe initial seed state. Repeated demonstrations can change balances.

## API behavior

Log in through `POST /auth/login`. Copy `accessToken`, select **Authorize** in Swagger, and paste the token alone. Tokens last one hour; the UI does not persist authorization across reloads. Readers can call either GET endpoint; administrators can also write.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | Staff login |
| POST | `/students` | Create student |
| GET | `/students/:id` | Student details |
| POST | `/students/:id/charges` | Add charge |
| POST | `/students/:id/payments` | Record payment |
| GET | `/students/:id/fees` | Charges, payments, and derived totals |
| GET | `/health` | Database readiness |

All money fields are **integer piastres**: `50000` = EGP 500. JSON amounts must be positive integers, at most 2,000,000,000 piastres per entry. Decimal values and numeric strings are rejected. Ledger totals are checked against JavaScript's safe integer limit. Currency is always EGP.

Example charge: `{"amountMinor":150000,"description":"Term tuition"}`. Example payment: `{"amountMinor":50000,"reference":"DEMO-PAY-001"}`. References allow 3–80 letters, digits, underscores, or hyphens. The API trims and uppercases references, so `demo-pay-001` and `DEMO-PAY-001` collide. They are globally unique across students. A duplicate is a conflict, not an automatic success: retrieve the ledger to check the original payment before retrying after a network failure.

Errors have a stable envelope:

```json
{"error":{"code":"OVERPAYMENT","message":"Payment exceeds the outstanding balance"}}
```

Validation errors additionally include `details` with field paths and messages. Status codes: **400** invalid input/JSON/UUID; **401** invalid credentials/token; **403** insufficient permission; **404** missing student/route; **409** duplicate reference, overpayment, or transaction conflict; **413** oversized body; **429** login rate limit; **500** unexpected failure; **503** unavailable health dependency. Passwords, tokens, configuration, and stack traces are never logged. A login response intentionally returns its bearer token.

## Structure and decisions

`src/routes.ts` connects HTTP methods, authentication, permissions, and controllers. `src/controllers/` parses inputs and writes HTTP responses. `src/services/` contains student and financial behavior. `src/errors.ts` maps failures to HTTP responses. `src/openapi.ts` is the maintained OpenAPI document, served directly by the API. `prisma/` holds schema, SQL migration, and repeatable seed. There is no unnecessary repository layer.

The four tables are `StaffUser`, `Student`, `FeeCharge`, and `Payment`. Each financial record belongs to a student and references the staff member who created it, with a timestamp. Foreign keys prevent orphan records; SQL checks enforce positive bounded amounts and canonical references. Charges/payments are append-only through this API. No editable balance column exists: `sum(charges) - sum(payments)` is the outstanding balance. No student list endpoint is needed for the chosen workflow, so there is no pagination.

**Transactions:** every charge/payment writer locks the student's row using parameterized `SELECT ... FOR UPDATE`. At Read Committed isolation, another payment for that student waits for the first transaction to commit, then reads the updated ledger before checking overpayment. The database unique index handles duplicate-reference races even across different students. Checks and inserts commit or roll back together. Fee reads use Repeatable Read so all returned history and totals reflect one consistent snapshot. A transaction timeout is a 409 conflict; clients should retrieve fees before retrying. These guarantees assume financial writes go through this service; direct database writers must follow the same locking protocol.

**Authentication:** bcrypt stores salted password hashes; JWTs use HS256 with an environment secret, fixed issuer/audience, and one-hour expiry. Middleware reloads the staff account on each request so current permissions apply. Unknown-account logins still compare a dummy bcrypt hash. Login has an in-memory limit of 30 attempts per IP per 15 minutes. Request validation rejects unknown body fields and limits body size to 16 KB. The API does not log request bodies or authorization headers.

## Tests and database safety

`npm test` uses `DATABASE_URL` as the connection for creating a **new random database**, not as a database to reset. The role must have `CREATEDB`, as the dedicated Compose role does. If needed, set `TEST_DATABASE_ADMIN_URL` to a separate local role with that privilege. Do not point it at production.

The runner creates `school_office_test_<random hex>`, applies real migrations, runs Vitest/Supertest, and drops only the database it created in a `finally` block. It never runs `migrate reset`, truncates a supplied database, or drops an existing database. Tests also reject URLs that lack the expected test-name shape. An interrupted/killed runner may leave its random test database behind; inspect its name before manually removing it.

Coverage includes login failures, permissions on all write endpoints, malformed tokens, student validation/not-found cases, audit fields, exact balances, invalid amounts, full settlement, overpayments, normalized/global duplicate references, concurrent overpayments, concurrent payments that both fit, cross-student reference races, docs, health, and JSON error handling. The tests use a real PostgreSQL instance and exercise HTTP routes and transactions together.

## Demonstration and explanation

See [the timed walkthrough](docs/WALKTHROUGH.md) for a 4-minute Swagger sequence and [interview preparation](docs/INTERVIEW.md) for concepts to explain.

This is a recruitment demo. It omits student search/listing, deletions, refunds/reversals, online payment processing, enrollment, payroll, frontend dashboards, user administration, password resets, refresh tokens, and distributed rate limiting. Fee history is unpaginated for small demo ledgers. Unexpected failures use a deliberately minimal log; production would need redacted structured observability. Secrets, TLS, backups, deployment, and broader operational security require separate production work. The OpenAPI document is maintained manually alongside the routes.

Assignment deadline: **8 November 2026, 23:59 UTC+6**, equivalent to **19:59 Cairo time**. Nothing is published, deployed, or submitted automatically.
