# Verification

Verified locally on 7 November 2026 using Windows, Node.js 22.18.0, npm 11.2.0, PostgreSQL 18, and Prisma 7.10.1.

| Check | Result |
| --- | --- |
| Prisma client generation | Passed |
| Initial SQL migration applied to new demo database | Passed |
| Seed, including a second run | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `npm test` | 18 tests passed against a newly allocated PostgreSQL database |
| Simultaneous payments exceeding balance | Exactly one succeeded; balance remained positive |
| Simultaneous payments fitting balance | Both succeeded; balance reached zero |
| Simultaneous duplicate references across students | Exactly one succeeded; other returned 409 |
| Swagger UI in browser | Loaded all seven operations and bearer authorization control |
| `npm audit --omit=dev --audit-level=high` | Zero reported vulnerabilities at verification time |

Docker Compose is supplied for repeatable setup but was not executed because Docker Desktop was not running on this machine. Verification used a separate temporary PostgreSQL cluster instead. No public hosting, GitHub publication, or submission was attempted. Swagger served successfully in the browser; API behavior was exercised with Supertest against the same Express application and real PostgreSQL.
