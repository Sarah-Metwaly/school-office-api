import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Client } from 'pg';

// Never migrate, truncate, reset, or drop a user-supplied database. Allocate a fresh
// random database, run migrations/tests there, and only drop that exact allocation.
const baseUrl = process.env.TEST_DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!baseUrl) throw new Error('Set DATABASE_URL or TEST_DATABASE_ADMIN_URL to a local PostgreSQL server whose role can CREATE DATABASE.');
const databaseName = `school_office_test_${randomUUID().replaceAll('-', '')}`;
const testUrl = new URL(baseUrl);
testUrl.pathname = `/${databaseName}`;
const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: testUrl.toString(), JWT_SECRET: 'isolated-test-secret-at-least-32-characters' };
const admin = new Client({ connectionString: baseUrl });
let created = false;
function run(bin: string, args: string[]) {
  const result = spawnSync(process.execPath, [bin, ...args], { env, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error(`Test step failed: ${args.join(' ')}`);
}
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  run('node_modules/prisma/build/index.js', ['migrate', 'deploy']);
  run('node_modules/vitest/vitest.mjs', ['run']);
} catch (error) {
  console.error(error instanceof Error ? error.message.replaceAll(baseUrl, '[database URL]') : 'Test run failed');
  process.exitCode = 1;
} finally {
  if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
  await admin.end();
}
