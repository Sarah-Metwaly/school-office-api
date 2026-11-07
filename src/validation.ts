import { z } from 'zod';

export const studentIdSchema = z.uuid();
export const amountSchema = z.number().int().positive().max(2_000_000_000);
export const studentSchema = z.object({ fullName: z.string().trim().min(1).max(100), grade: z.string().trim().min(1).max(30) }).strict();
export const chargeSchema = z.object({ amountMinor: amountSchema, description: z.string().trim().min(1).max(200) }).strict();
// References are case insensitive and stored in a canonical uppercase form.
export const paymentSchema = z.object({ amountMinor: amountSchema, reference: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9_-]+$/).transform(v => v.toUpperCase()) }).strict();
export const loginSchema = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(128) }).strict();
