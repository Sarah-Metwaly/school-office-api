import bcrypt from 'bcryptjs';
import { db } from '../src/db.js';
import { z } from 'zod';

const passwords = z.object({ DEMO_ADMIN_PASSWORD: z.string().min(12).max(72), DEMO_READER_PASSWORD: z.string().min(12).max(72) }).parse(process.env);
try {
  const adminHash = await bcrypt.hash(passwords.DEMO_ADMIN_PASSWORD, 12);
  const readerHash = await bcrypt.hash(passwords.DEMO_READER_PASSWORD, 12);
  await db.$transaction(async tx => {
    const admin = await tx.staffUser.upsert({ where: { email: 'admin@school.demo' }, update: { passwordHash: adminHash, role: 'ADMIN' }, create: { email: 'admin@school.demo', passwordHash: adminHash, role: 'ADMIN' } });
    await tx.staffUser.upsert({ where: { email: 'reader@school.demo' }, update: { passwordHash: readerHash, role: 'READ_ONLY' }, create: { email: 'reader@school.demo', passwordHash: readerHash, role: 'READ_ONLY' } });
    const examples = [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Mariam Demo', charge: 150000, paid: 50000 },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Omar Example', charge: 120000, paid: 120000 },
      { id: '33333333-3333-4333-8333-333333333333', name: 'Nour Sample', charge: 90000, paid: 0 },
    ];
    for (const [index, example] of examples.entries()) {
      // Existing demo students are left untouched, including any demonstration payments.
      if (await tx.student.findUnique({ where: { id: example.id } })) continue;
      await tx.student.create({ data: { id: example.id, fullName: example.name, grade: `Grade ${index + 7}` } });
      await tx.feeCharge.create({ data: { studentId: example.id, amountMinor: example.charge, description: 'Term tuition', createdById: admin.id } });
      if (example.paid) await tx.payment.create({ data: { studentId: example.id, amountMinor: example.paid, reference: `SEED-2026-${index + 1}`, createdById: admin.id } });
    }
  }, { timeout: 15000 });
  console.log('Fictional demonstration records ready. See README for student IDs and local accounts.');
} finally { await db.$disconnect(); }
