import 'dotenv/config';
import { z } from 'zod';

const env = z.object({
  DATABASE_URL: z.url().refine(v => /^postgres(ql)?:/.test(v)),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
}).safeParse(process.env);

if (!env.success) {
  // Report variable names, never their values.
  throw new Error(`Invalid environment variables: ${env.error.issues.map(i => i.path.join('.')).join(', ')}`);
}
export const config = env.data;
