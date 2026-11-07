import type { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db } from './db.js';
import { AppError } from './errors.js';

declare global {
  namespace Express {
    interface Request { staff?: { id: string; role: 'ADMIN' | 'READ_ONLY' } }
  }
}
const tokenOptions = { algorithm: 'HS256' as const, issuer: 'school-office-api', audience: 'school-office-staff' };
// A real hash makes unknown-account login perform the same expensive comparison.
const dummyHash = bcrypt.hashSync('unused-dummy-password', 12);

export async function login(email: string, password: string) {
  const user = await db.staffUser.findUnique({ where: { email } });
  const valid = await bcrypt.compare(password, user?.passwordHash ?? dummyHash);
  if (!user || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  return { accessToken: jwt.sign({}, config.JWT_SECRET, { ...tokenOptions, subject: user.id, expiresIn: '1h' }), tokenType: 'Bearer', expiresIn: 3600, staff: { id: user.id, email: user.email, role: user.role } };
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  const match = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? '');
  if (!match?.[1]) throw new AppError(401, 'UNAUTHORIZED', 'A valid bearer token is required');
  let subject: string;
  try {
    const payload = jwt.verify(match[1], config.JWT_SECRET, { algorithms: ['HS256'], issuer: tokenOptions.issuer, audience: tokenOptions.audience });
    if (typeof payload === 'string' || !payload.sub) throw new Error('Invalid subject');
    subject = payload.sub;
  } catch { throw new AppError(401, 'UNAUTHORIZED', 'A valid bearer token is required'); }
  const user = await db.staffUser.findUnique({ where: { id: subject } });
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'A valid bearer token is required');
  req.staff = { id: user.id, role: user.role };
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.staff?.role !== 'ADMIN') throw new AppError(403, 'FORBIDDEN', 'Administrator role required');
  next();
};
