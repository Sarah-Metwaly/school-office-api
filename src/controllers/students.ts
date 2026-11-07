import type { RequestHandler } from 'express';
import { studentIdSchema, studentSchema, chargeSchema, paymentSchema } from '../validation.js';
import * as students from '../services/students.js';
import * as fees from '../services/fees.js';

export const create: RequestHandler = async (req, res) => {
  const student = await students.createStudent(studentSchema.parse(req.body));
  res.status(201).location(`/students/${student.id}`).json(student);
};
export const get: RequestHandler = async (req, res) => { res.json(await students.getStudent(studentIdSchema.parse(req.params.id))); };
export const getFees: RequestHandler = async (req, res) => { res.json(await fees.getFees(studentIdSchema.parse(req.params.id))); };
export const charge: RequestHandler = async (req, res) => { res.status(201).json(await fees.addCharge(studentIdSchema.parse(req.params.id), req.staff!.id, chargeSchema.parse(req.body))); };
export const payment: RequestHandler = async (req, res) => { res.status(201).json(await fees.recordPayment(studentIdSchema.parse(req.params.id), req.staff!.id, paymentSchema.parse(req.body))); };
