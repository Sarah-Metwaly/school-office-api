import { Prisma } from '../generated/prisma/client.js';
import { db } from '../db.js';
import { AppError } from '../errors.js';
import { chargeSchema, paymentSchema } from '../validation.js';
import type { z } from 'zod';

// Kept here so every balance uses the same integer arithmetic.
export function calculateBalance(charges: readonly { amountMinor: number }[], payments: readonly { amountMinor: number }[]) {
  const totalChargesMinor = charges.reduce((sum, c) => sum + c.amountMinor, 0);
  const totalPaymentsMinor = payments.reduce((sum, p) => sum + p.amountMinor, 0);
  if (![totalChargesMinor, totalPaymentsMinor].every(Number.isSafeInteger)) {
    throw new AppError(409, 'LEDGER_LIMIT', 'Ledger exceeds supported safe integer totals');
  }
  return { totalChargesMinor, totalPaymentsMinor, outstandingMinor: totalChargesMinor - totalPaymentsMinor };
}

async function lockStudent(tx: Prisma.TransactionClient, studentId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Student" WHERE id = ${studentId}::uuid FOR UPDATE`;
  if (!rows.length) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found');
}

export async function getFees(studentId: string) {
  // A single relation read in Repeatable Read keeps charges and payments on one snapshot.
  return db.$transaction(async tx => {
    const student = await tx.student.findUnique({ where: { id: studentId }, include: { charges: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }, payments: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } } });
    if (!student) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found');
    return { studentId, currency: 'EGP', ...calculateBalance(student.charges, student.payments), charges: student.charges, payments: student.payments };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function addCharge(studentId: string, createdById: string, input: z.infer<typeof chargeSchema>) {
  const data = chargeSchema.parse(input);
  return db.$transaction(async tx => {
    await lockStudent(tx, studentId);
    const charges = await tx.feeCharge.findMany({ where: { studentId }, select: { amountMinor: true } });
    calculateBalance([...charges, data], []);
    return tx.feeCharge.create({ data: { ...data, studentId, createdById } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

export async function recordPayment(studentId: string, createdById: string, input: z.infer<typeof paymentSchema>) {
  const data = paymentSchema.parse(input);
  return db.$transaction(async tx => {
    // All charge/payment writers take the same lock before reading the ledger.
    await lockStudent(tx, studentId);
    if (await tx.payment.findUnique({ where: { reference: data.reference } })) {
      throw new AppError(409, 'DUPLICATE_REFERENCE', 'Payment reference already exists');
    }
    const charges = await tx.feeCharge.findMany({ where: { studentId }, select: { amountMinor: true } });
    const payments = await tx.payment.findMany({ where: { studentId }, select: { amountMinor: true } });
    const { outstandingMinor } = calculateBalance(charges, payments);
    if (data.amountMinor > outstandingMinor) throw new AppError(409, 'OVERPAYMENT', 'Payment exceeds the outstanding balance');
    return tx.payment.create({ data: { ...data, studentId, createdById } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 5000, timeout: 10000 });
}
