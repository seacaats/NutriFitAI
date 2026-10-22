const { z } = require('zod');

const { ROLES } = require('../middleware/authMiddleware');
const { CATEGORIES } = require('../utils/audit-logs/actions');
const { MAX_PAGE_SIZE } = require('../models/audit-logs/AuditLog');
const { personName, EMAIL_MAX } = require('./shared/fieldSchemas');

const pagination = {
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
};

const timestamp = z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), {
  message: 'Expected an ISO 8601 timestamp',
});

const userIdParamSchema = z.object({ id: z.string().uuid() }).strict();

const auditLogIdParamSchema = z
  .object({ id: z.string().regex(/^[0-9a-f]{24}$/i) })
  .strict();

const imageReviewIdParamSchema = z
  .object({ id: z.string().regex(/^[0-9a-f]{24}$/i) })
  .strict();

const imageReviewQuerySchema = z
  .object({
    ...pagination,
    tab: z.enum(['review', 'blocked', 'unchecked']).default('review'),
    kind: z.enum(['avatar', 'scan', 'workout']).optional(),
    category: z.enum(['sexual', 'violence', 'violence/graphic', 'self-harm', 'self-harm/intent', 'self-harm/instructions']).optional(),
    days: z.coerce.number().int().min(1).max(90).optional(),
    userId: z.string().uuid().optional(),
    repeat: z.enum(['true']).optional(),
  })
  .strict();

// Shared filters for audit log queries and CSV exports
const auditFilters = {
  category: z.enum(CATEGORIES).optional(),
  action: z.string().max(100).optional(),
  subjectId: z.string().uuid().optional(),
  subjectMode: z.enum(['all', 'actor', 'target', 'self']).optional(),
  from: timestamp.optional(),
  to: timestamp.optional(),
};

const fromBeforeTo = (q) => !q.from || !q.to || q.from <= q.to;
const fromBeforeToMessage = { message: 'The start date must be before the end date.' };

const auditLogQuerySchema = z
  .object({
    ...pagination,
    held: z.enum(['true']).optional(),
    noted: z.enum(['true']).optional(),
    ...auditFilters,
  })
  .strict()
  .refine(fromBeforeTo, fromBeforeToMessage);

const userListQuerySchema = z
  .object({
    ...pagination,
    search: z.string().trim().max(120).optional(),
    role: z.enum(ROLES).optional(),
  })
  .strict();

const reason = z.string().trim().min(3).max(300);

const adminReasonSchema = z.object({ reason }).strict();

const adminNoticeSchema = z.object({ reason, userMessage: z.string().trim().min(3).max(300).optional() }).strict();

const sessionParamSchema = z.object({ id: z.string().uuid(), sid: z.string().uuid() }).strict();

const adminCreateUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Please enter a valid email address.').max(EMAIL_MAX, 'Email is too long.'),
    firstName: personName('First name', { required: true }),
    lastName: personName('Last name').optional(),
    role: z.enum(ROLES).optional(),
    reason,
  })
  .strict();

const adminProfileSchema = z
  .object({
    firstName: personName('First name', { required: true }).optional(),
    lastName: personName('Last name').nullable().optional(),
    reason,
  })
  .strict()
  .refine((b) => b.firstName !== undefined || b.lastName !== undefined, {
    message: 'There are no changes to save.',
  });

const auditExportQuerySchema = z
  .object({ ...auditFilters })
  .strict()
  .refine(fromBeforeTo, fromBeforeToMessage);

const auditNoteSchema = z.object({ body: z.string().trim().min(1).max(1000) }).strict();

module.exports = {
  userIdParamSchema,
  auditLogIdParamSchema,
  imageReviewIdParamSchema,
  imageReviewQuerySchema,
  auditNoteSchema,
  auditLogQuerySchema,
  auditExportQuerySchema,
  userListQuerySchema,
  adminReasonSchema,
  adminNoticeSchema,
  adminProfileSchema,
  adminCreateUserSchema,
  sessionParamSchema,
};
