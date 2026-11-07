# Four-minute English walkthrough

Prepare: start the API, open `/docs`, keep the README's student ID handy, and use a fresh reference for each rehearsal. To guarantee the same starting state, demonstrate on a newly created student. Expand only the endpoints needed.

| Time | Action in Swagger | Suggested narration |
| --- | --- | --- |
| 0:00–0:25 | Show the title and `GET /health` (200) | “School Office API is a focused school administration demo. The core feature is fee tracking, supported by student records and staff permissions. It records payments but does not process real money.” |
| 0:25–0:50 | `POST /auth/login` as `admin@school.demo`; copy `accessToken`; select Authorize and paste token alone | “Passwords are hashed with bcrypt. A successful login returns a one-hour bearer token. Administrator and read-only permissions are checked on the server.” |
| 0:50–1:15 | `POST /students`: `{"fullName":"Salma Fictional","grade":"Grade 8"}`; copy returned ID; `GET /students/{id}` | “This creates a fictional student. I use the generated ID to retrieve the same record. Invalid input returns a consistent validation response.” |
| 1:15–1:45 | `POST /students/{id}/charges`: `{"amountMinor":150000,"description":"Term tuition"}` | “All money uses integer piastres, so 150000 means 1500 Egyptian pounds. This avoids floating-point rounding. Each charge stores the responsible staff member and timestamp.” |
| 1:45–2:15 | `POST /students/{id}/payments`: `{"amountMinor":50000,"reference":"WALKTHROUGH-001"}`; then `GET /students/{id}/fees` | “After this 500-pound payment, the outstanding amount is 1000 pounds. The balance is calculated from charges and payments, rather than stored as an editable value.” |
| 2:15–2:50 | Repeat payment with same reference (409); try `{"amountMinor":100001,"reference":"WALKTHROUGH-OVER"}` (409); optionally zero amount (400) | “The database enforces unique payment references, and the service rejects overpayments. A transaction locks the student's row before checking the balance, so concurrent requests cannot both use the same available balance.” |
| 2:50–3:20 | Login as `reader@school.demo`, replace authorization; GET fees (200), attempt charge (403) | “The read-only account can inspect records but cannot change them. This permission is enforced by middleware on every write route.” |
| 3:20–4:00 | Show terminal test result and briefly show `src/services/fees.ts`, schema, and README | “The tests use an isolated real PostgreSQL database, including concurrent payment tests. Routes handle HTTP, services contain business rules, and Prisma manages the schema and migrations. I kept refunds, enrollment, and payment gateways outside this demo.” |

If you have a fifth minute, explain how a unique index handles two students submitting the same reference, and why a consistent snapshot matters when reading the ledger. Never show `.env` or expose the token in a public recording unnecessarily. Seed passwords are explicitly fictional local credentials.
