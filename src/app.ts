import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { db } from './db.js';
import { routes } from './routes.js';
import { errorHandler } from './errors.js';
import { openapi } from './openapi.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '16kb' }));
app.get('/health', async (_req, res) => {
  try { await db.$queryRaw`SELECT 1`; res.json({ status: 'ok' }); }
  catch { res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database unavailable' } }); }
});
app.get('/openapi.json', (_req, res) => { res.json(openapi); });
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { swaggerOptions: { persistAuthorization: false } }));
app.use(routes);
app.use((_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }); });
app.use(errorHandler);
