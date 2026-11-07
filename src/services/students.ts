import { db } from '../db.js';
import { AppError } from '../errors.js';
import type { z } from 'zod';
import { studentSchema } from '../validation.js';

export const createStudent = (input: z.infer<typeof studentSchema>) => db.student.create({ data: studentSchema.parse(input) });
export async function getStudent(id: string) {
  const student = await db.student.findUnique({ where: { id } });
  if (!student) throw new AppError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  return student;
}
