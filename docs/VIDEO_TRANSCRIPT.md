# Video narration transcript

Edited Swagger walkthrough with synthetic English neural narration, prepared for Sarah Metwaly. All records shown are fictional local demo data.

## School Office API

Welcome to School Office API, Sarah Metwaly's backend demo for the Credosis internship. The goal is simple: give school staff one clear place to record student fees and payments. This walkthrough follows a real request sequence in Swagger, then explains the decisions that keep the financial records consistent.

## A focused backend

The project uses TypeScript, Express, PostgreSQL, and Prisma, with Zod for validation. There are four tables: staff users, students, fee charges, and payments. Every financial entry belongs to a student and records who created it and when. Enrollment, payroll, and online payment processing stay outside this demo.

## Identify the staff member

First, the administrator logs in through the authentication endpoint. The server compares the password with a bcrypt hash and returns a bearer token that expires after one hour. Swagger's Authorize control attaches that token to protected requests. The server also reloads the staff account on each request, so its current role determines permission.

## Create a student

Next, a fictional student, Salma, is created in Grade Eight. The API returns status two hundred and one, a generated identifier, and a creation timestamp. That identifier connects the student to every later charge and payment. Input validation rejects empty names, invalid identifiers, and unexpected fields.

## Add the fee charge

Now the administrator adds a tuition charge of fifteen hundred Egyptian pounds. The request sends one hundred and fifty thousand integer minor units, or piastres. One hundred piastres equals one pound. Integer arithmetic avoids floating point rounding errors. The saved charge includes its description, timestamp, and the responsible staff user's identifier.

## Record a payment

A payment of five hundred pounds is recorded with a clear payment reference. References are trimmed and converted to uppercase, so changing letter case cannot bypass duplicate protection. A database unique constraint enforces that rule across all students. This endpoint records an office payment; it does not charge a card or connect to a payment gateway.

## Read the exact balance

The fees endpoint returns the charge history, payment history, and outstanding balance. Here, fifteen hundred pounds in charges minus five hundred in payments leaves one thousand pounds outstanding. There is no separately editable balance column. The service derives totals from the ledger, and reads the related records within one consistent database snapshot.

## Reject conflicting payments

Two failure cases matter. Reusing the payment reference returns a conflict. Trying to pay more than the outstanding balance also returns a conflict, without inserting a payment. Zero, negative, and decimal amounts return a validation error. Each response uses the same error structure, with a useful code and message, while internal details stay hidden.

## Enforce read-only access

The second seeded account has read only access. It can inspect student details and fee history, but an attempt to add a charge returns status four hundred and three. Authentication answers who is making the request. Authorization answers whether that staff member may perform the action. Both checks happen on the server.

## Make concurrent payments safe

The most important safeguard is inside the payment transaction. Imagine two payments of seventy pounds arriving against a balance of one hundred. Both requests must lock the same student row before reading the ledger. The first records seventy and commits. The second then sees only thirty remaining and rejects seventy. Read Committed isolation makes that fresh read possible. Charges follow the same locking rule, and any failed transaction rolls back.

## Verify the important behavior

Verification uses Vitest and Supertest against real PostgreSQL. All eighteen tests passed, including login, permissions, exact balances, duplicate references, and concurrent payments. The test runner creates a new randomly named database, applies migrations, and removes only that database afterward. TypeScript checking and the production build also passed. These checks exercise the actual API and database behavior.

## Ready to review

The public repository includes the source, migrations, fictional seed data, setup instructions, and Swagger documentation. This is a focused recruitment demo with one complete financial workflow and clear supporting features. Thank you for reviewing School Office API.

