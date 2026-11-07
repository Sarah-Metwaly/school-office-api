import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { Prisma } from './generated/prisma/client.js';

export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })) } });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } }); return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { code: 'DUPLICATE_REFERENCE', message: 'Payment reference already exists' } }); return;
    }
    if (['P2034', 'P2028'].includes(err.code)) {
      res.status(409).json({ error: { code: 'PAYMENT_CONFLICT', message: 'Transaction conflicted or timed out; retrieve fees before retrying' } }); return;
    }
  }
  const status = typeof err === 'object' && err !== null && 'status' in err ? err.status : undefined;
  if (status === 400 || status === 413 || status === 415) {
    res.status(status).json({ error: { code: 'INVALID_BODY', message: 'Request body must be valid JSON under 16 KB' } }); return;
  }
  console.error('Unhandled request failure');
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
};
