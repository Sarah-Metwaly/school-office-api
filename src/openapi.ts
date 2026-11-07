const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ 'application/json': { schema } });
const response = (description: string, schema: object) => ({ description, content: json(schema) });
const body = (schema: object) => ({ required: true, content: json(schema) });
const id = { type: 'string', format: 'uuid', example: '11111111-1111-4111-8111-111111111111' };
const date = { type: 'string', format: 'date-time', example: '2026-11-07T12:00:00.000Z' };
const amount = { type: 'integer', minimum: 1, maximum: 2000000000, description: 'Integer piastres: 100 = EGP 1. No decimals.', example: 50000 };
const studentInput = { type: 'object', additionalProperties: false, required: ['fullName', 'grade'], properties: { fullName: { type: 'string', minLength: 1, maxLength: 100, example: 'Salma Fictional' }, grade: { type: 'string', minLength: 1, maxLength: 30, example: 'Grade 8' } } };
const chargeInput = { type: 'object', additionalProperties: false, required: ['amountMinor', 'description'], properties: { amountMinor: amount, description: { type: 'string', minLength: 1, maxLength: 200, example: 'Term tuition' } } };
const paymentInput = { type: 'object', additionalProperties: false, required: ['amountMinor', 'reference'], properties: { amountMinor: amount, reference: { type: 'string', minLength: 3, maxLength: 80, pattern: '^[a-zA-Z0-9_-]+$', description: 'Globally unique, trimmed and converted to uppercase. Reusing a reference returns 409.', example: 'DEMO-PAY-001' } } };
const errors = {
  '400': response('Invalid JSON, UUID, or request values', ref('Error')),
  '401': response('Missing, invalid or expired credentials', ref('Error')),
  '403': response('Administrator role required', ref('Error')),
  '404': response('Student not found', ref('Error')),
  '409': response('Duplicate reference, overpayment, or transaction conflict', ref('Error')),
  '500': response('Unexpected server failure', ref('Error')),
};
const parameter = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } };
const operation = (summary: string, schema: string, input?: string) => ({ tags: ['Students and fees'], summary, parameters: [parameter], ...(input ? { requestBody: body(ref(input)) } : {}), responses: { [input ? '201' : '200']: response('Success', ref(schema)), ...errors } });

export const openapi = {
  openapi: '3.0.3',
  info: { title: 'School Office API', version: '1.0.0', description: 'A focused school administration recruitment demo. All money is in integer piastres (100 = EGP 1). Log in, copy accessToken, then select Authorize and paste the token. ADMIN writes; READ_ONLY reads. Charges and payments form an append-only ledger. Payments cannot exceed the balance. No actual payment processing occurs.' },
  servers: [{ url: '/', description: 'This server' }],
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': { get: { tags: ['Health'], summary: 'Check API and database availability', security: [], responses: { '200': response('Ready', { type: 'object', required: ['status'], properties: { status: { type: 'string', example: 'ok' } } }), '503': response('Database unavailable', ref('Error')) } } },
    '/auth/login': { post: { tags: ['Authentication'], summary: 'Log in with a seeded staff account', security: [], requestBody: body({ type: 'object', additionalProperties: false, required: ['email', 'password'], properties: { email: { type: 'string', format: 'email', example: 'admin@school.demo' }, password: { type: 'string', format: 'password', minLength: 1, maxLength: 128, example: 'AdminDemo123!' } } }), responses: { '200': response('One-hour bearer token', ref('Login')), '400': errors['400'], '401': errors['401'], '429': response('30 login attempts per IP per 15 minutes exceeded', ref('Error')) } } },
    '/students': { post: { tags: ['Students and fees'], summary: 'Create a student (ADMIN)', requestBody: body(ref('StudentInput')), responses: { '201': response('Student created', ref('Student')), ...errors } } },
    '/students/{id}': { get: operation('Retrieve a student (either role)', 'Student') },
    '/students/{id}/charges': { post: operation('Add a fee charge (ADMIN)', 'FeeCharge', 'ChargeInput') },
    '/students/{id}/payments': { post: operation('Record a payment (ADMIN)', 'Payment', 'PaymentInput') },
    '/students/{id}/fees': { get: operation('Read ledger and derived balance (either role)', 'Fees') },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      StudentInput: studentInput, ChargeInput: chargeInput, PaymentInput: paymentInput,
      Student: { type: 'object', required: ['id', 'fullName', 'grade', 'createdAt'], properties: { id, ...studentInput.properties, createdAt: date } },
      FeeCharge: { type: 'object', required: ['id', 'studentId', 'amountMinor', 'description', 'createdById', 'createdAt'], properties: { id, studentId: id, ...chargeInput.properties, createdById: id, createdAt: date } },
      Payment: { type: 'object', required: ['id', 'studentId', 'amountMinor', 'reference', 'createdById', 'createdAt'], properties: { id, studentId: id, ...paymentInput.properties, createdById: id, createdAt: date } },
      Fees: { type: 'object', required: ['studentId', 'currency', 'totalChargesMinor', 'totalPaymentsMinor', 'outstandingMinor', 'charges', 'payments'], properties: { studentId: id, currency: { type: 'string', enum: ['EGP'] }, totalChargesMinor: { type: 'integer', minimum: 0, example: 150000 }, totalPaymentsMinor: { type: 'integer', minimum: 0, example: 50000 }, outstandingMinor: { type: 'integer', minimum: 0, example: 100000 }, charges: { type: 'array', items: ref('FeeCharge') }, payments: { type: 'array', items: ref('Payment') } } },
      Login: { type: 'object', required: ['accessToken', 'tokenType', 'expiresIn', 'staff'], properties: { accessToken: { type: 'string', example: 'eyJ...paste-the-returned-token' }, tokenType: { type: 'string', enum: ['Bearer'] }, expiresIn: { type: 'integer', example: 3600 }, staff: { type: 'object', required: ['id', 'email', 'role'], properties: { id, email: { type: 'string', format: 'email' }, role: { type: 'string', enum: ['ADMIN', 'READ_ONLY'] } } } } },
      Error: { type: 'object', required: ['error'], properties: { error: { type: 'object', required: ['code', 'message'], properties: { code: { type: 'string', example: 'OVERPAYMENT' }, message: { type: 'string', example: 'Payment exceeds the outstanding balance' }, details: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, message: { type: 'string' } } } } } } } },
    },
  },
};
