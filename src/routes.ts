import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, requireAdmin, login } from './auth.js';
import { loginSchema } from './validation.js';
import * as students from './controllers/students.js';

export const routes = Router();
routes.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts; try again later' } } }), async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  res.json(await login(email, password));
});
routes.use('/students', authenticate);
routes.post('/students', requireAdmin, students.create);
routes.get('/students/:id', students.get);
routes.get('/students/:id/fees', students.getFees);
routes.post('/students/:id/charges', requireAdmin, students.charge);
routes.post('/students/:id/payments', requireAdmin, students.payment);
