import { app } from './app.js';
import { config } from './config.js';
import { db } from './db.js';

await db.$connect();
const server = app.listen(config.PORT, '127.0.0.1', () => console.log(`School Office API: http://localhost:${config.PORT}/docs`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    const timer = setTimeout(() => process.exit(1), 10000).unref();
    server.close(() => { void db.$disconnect().finally(() => { clearTimeout(timer); process.exit(0); }); });
  });
}
