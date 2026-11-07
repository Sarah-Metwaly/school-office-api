import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { db } from '../src/db.js';
import { app } from '../src/app.js';
import { calculateBalance } from '../src/services/fees.js';

let adminToken: string;
let readerToken: string;
let adminId: string;
const api = request(app);
const auth = (token = adminToken) => ({ Authorization: `Bearer ${token}` });
async function studentWithCharge(amountMinor = 10000) {
  const student = await api.post('/students').set(auth()).send({ fullName: 'Fictional Test', grade: 'Grade 8' }).expect(201);
  await api.post(`/students/${student.body.id}/charges`).set(auth()).send({ amountMinor, description: 'Tuition' }).expect(201);
  return student.body.id as string;
}

beforeAll(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.match(/^\/school_office_test_[a-f0-9]{32}$/)) throw new Error('Run npm test to allocate an isolated database');
  const passwordHash = await bcrypt.hash('TestPassword123!', 12);
  const admin = await db.staffUser.create({ data: { email: 'admin@test.demo', passwordHash, role: 'ADMIN' } });
  adminId = admin.id;
  await db.staffUser.create({ data: { email: 'reader@test.demo', passwordHash, role: 'READ_ONLY' } });
  adminToken = (await api.post('/auth/login').send({ email: 'admin@test.demo', password: 'TestPassword123!' }).expect(200)).body.accessToken;
  readerToken = (await api.post('/auth/login').send({ email: 'reader@test.demo', password: 'TestPassword123!' }).expect(200)).body.accessToken;
});
afterAll(async () => { await db.$disconnect(); });

describe('Authentication and permissions', () => {
  it('logs in without exposing hashes, rejects invalid and unknown credentials', async () => {
    const res = await api.post('/auth/login').send({ email: 'admin@test.demo', password: 'TestPassword123!' }).expect(200);
    expect(res.body.staff.role).toBe('ADMIN');
    expect(JSON.stringify(res.body)).not.toContain('password');
    for (const email of ['admin@test.demo', 'unknown@test.demo']) {
      expect((await api.post('/auth/login').send({ email, password: 'wrong' }).expect(401)).body.error.code).toBe('INVALID_CREDENTIALS');
    }
  });
  it('rejects missing, tampered and expired tokens', async () => {
    await api.get(`/students/${randomUUID()}`).expect(401);
    await api.get(`/students/${randomUUID()}`).set(auth('broken')).expect(401);
    const expired = jwt.sign({}, process.env.JWT_SECRET!, { subject: adminId, expiresIn: -1, issuer: 'school-office-api', audience: 'school-office-staff' });
    await api.get(`/students/${randomUUID()}`).set(auth(expired)).expect(401);
  });
  it('allows readers to retrieve records but forbids all writes', async () => {
    const id = await studentWithCharge();
    await api.get(`/students/${id}`).set(auth(readerToken)).expect(200);
    await api.get(`/students/${id}/fees`).set(auth(readerToken)).expect(200);
    await api.post('/students').set(auth(readerToken)).send({ fullName: 'No', grade: '8' }).expect(403);
    await api.post(`/students/${id}/charges`).set(auth(readerToken)).send({ amountMinor: 100, description: 'No' }).expect(403);
    await api.post(`/students/${id}/payments`).set(auth(readerToken)).send({ amountMinor: 100, reference: 'NO' }).expect(403);
  });
});

describe('Students and ledger', () => {
  it('creates students, trims fields, validates input and reports missing students', async () => {
    const res = await api.post('/students').set(auth()).send({ fullName: '  Test Name  ', grade: ' 8 ' }).expect(201);
    expect(res.body.fullName).toBe('Test Name');
    expect(res.headers.location).toBe(`/students/${res.body.id}`);
    await api.get(`/students/${res.body.id}`).set(auth()).expect(200);
    await api.post('/students').set(auth()).send({ fullName: '', grade: '8' }).expect(400);
    await api.post('/students').set(auth()).send({ fullName: 'A', grade: '8', balance: 123 }).expect(400);
    await api.get('/students/invalid').set(auth()).expect(400);
    const missing = randomUUID();
    await api.get(`/students/${missing}`).set(auth()).expect(404);
    await api.get(`/students/${missing}/fees`).set(auth()).expect(404);
    await api.post(`/students/${missing}/charges`).set(auth()).send({ amountMinor: 100, description: 'Tuition' }).expect(404);
    await api.post(`/students/${missing}/payments`).set(auth()).send({ amountMinor: 100, reference: 'MISSING' }).expect(404);
  });
  it('records a payment with audit fields and calculates the exact balance', async () => {
    const id = await studentWithCharge(150000);
    const payment = await api.post(`/students/${id}/payments`).set(auth()).send({ amountMinor: 50000, reference: 'valid-001' }).expect(201);
    expect(payment.body).toMatchObject({ reference: 'VALID-001', createdById: adminId, amountMinor: 50000 });
    expect(payment.body.createdAt).toBeTruthy();
    const fees = (await api.get(`/students/${id}/fees`).set(auth()).expect(200)).body;
    expect(fees).toMatchObject({ currency: 'EGP', totalChargesMinor: 150000, totalPaymentsMinor: 50000, outstandingMinor: 100000 });
    expect(fees.charges[0].createdById).toBe(adminId);
    expect(fees.payments).toHaveLength(1);
    await api.post(`/students/${id}/payments`).set(auth()).send({ amountMinor: 100000, reference: 'VALID-002' }).expect(201);
    expect((await api.get(`/students/${id}/fees`).set(auth())).body.outstandingMinor).toBe(0);
  });
  it.each([0, -1, 1.5, '100', 2000000001, null])('rejects invalid charge and payment amount %s', async amountMinor => {
    const id = await studentWithCharge();
    await api.post(`/students/${id}/charges`).set(auth()).send({ amountMinor, description: 'Tuition' }).expect(400);
    await api.post(`/students/${id}/payments`).set(auth()).send({ amountMinor, reference: 'INVALID' }).expect(400);
  });
  it('rejects invalid references and overpayments without writing', async () => {
    const id = await studentWithCharge();
    for (const reference of ['', 'ab', 'spaces here']) await api.post(`/students/${id}/payments`).set(auth()).send({ amountMinor: 100, reference }).expect(400);
    const res = await api.post(`/students/${id}/payments`).set(auth()).send({ amountMinor: 10001, reference: 'TOO-MUCH' }).expect(409);
    expect(res.body.error.code).toBe('OVERPAYMENT');
    expect((await api.get(`/students/${id}/fees`).set(auth())).body.payments).toHaveLength(0);
  });
  it('enforces global reference uniqueness with normalization', async () => {
    const id = await studentWithCharge();
    const other = await studentWithCharge();
    await api.post(`/students/${id}/payments`).set(auth()).send({ amountMinor: 100, reference: 'unique-ref' }).expect(201);
    const duplicate = await api.post(`/students/${other}/payments`).set(auth()).send({ amountMinor: 100, reference: ' UNIQUE-REF ' }).expect(409);
    expect(duplicate.body.error.code).toBe('DUPLICATE_REFERENCE');
  });
  it('serializes concurrent overpayments on real PostgreSQL', async () => {
    const id = await studentWithCharge();
    const results = await Promise.all(['RACE-A', 'RACE-B'].map(reference => api.post(`/students/${id}/payments`).set(auth()).send({ amountMinor: 7000, reference })));
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(results.find(r => r.status === 409)!.body.error.code).toBe('OVERPAYMENT');
    const fees = (await api.get(`/students/${id}/fees`).set(auth())).body;
    expect(fees.outstandingMinor).toBe(3000);
    expect(fees.payments).toHaveLength(1);
  });
  it('handles concurrent duplicate references across different students at the unique constraint', async () => {
    const ids = await Promise.all([studentWithCharge(), studentWithCharge()]);
    const results = await Promise.all(ids.map(id => api.post(`/students/${id}/payments`).set(auth()).send({ amountMinor: 100, reference: 'CROSS-STUDENT-RACE' })));
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(results.find(r => r.status === 409)!.body.error.code).toBe('DUPLICATE_REFERENCE');
  });
  it('allows concurrent payments when both fit', async () => {
    const id = await studentWithCharge();
    const results = await Promise.all(['FITS-A', 'FITS-B'].map(reference => api.post(`/students/${id}/payments`).set(auth()).send({ amountMinor: 5000, reference })));
    expect(results.map(r => r.status)).toEqual([201, 201]);
    expect((await api.get(`/students/${id}/fees`).set(auth())).body.outstandingMinor).toBe(0);
  });
});

it('calculates minor units exactly, including empty ledgers and unsafe totals', () => {
  expect(calculateBalance([], []).outstandingMinor).toBe(0);
  expect(calculateBalance([{ amountMinor: 10 }, { amountMinor: 20 }], [{ amountMinor: 10 }]).outstandingMinor).toBe(20);
  expect(() => calculateBalance([{ amountMinor: Number.MAX_SAFE_INTEGER }, { amountMinor: 1 }], [])).toThrow('safe integer');
});
it('serves health, Swagger and OpenAPI; handles JSON and unknown routes consistently', async () => {
  await api.get('/health').expect(200);
  expect((await api.get('/docs/').expect(200)).text).toContain('swagger-ui');
  const spec = (await api.get('/openapi.json').expect(200)).body;
  expect(Object.keys(spec.paths)).toHaveLength(7);
  await api.get('/missing').expect(404);
  const res = await api.post('/auth/login').set('Content-Type', 'application/json').send('{broken').expect(400);
  expect(res.body.error.code).toBe('INVALID_BODY');
  expect(JSON.stringify(res.body)).not.toContain('stack');
});
