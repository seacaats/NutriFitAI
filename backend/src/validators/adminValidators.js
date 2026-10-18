const { z } = require('zod');

const { ROLES } = require('../middleware/authMiddleware');
const { CATEGORIES } = require('../utils/audit-logs/actions');
const { MAX_PAGE_SIZE } = require('../models/audit-logs/AuditLog');
const { personName } = require('./authValidators');

// Fetched from the model to avoid conflicts with the database
const pagination = {
  page: z.coerce.number().int().min(1).max(10000).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
};

// Converts to date unlike other calendar-day fields 
// because instants are an exact moment of time 
const timestamp = z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), {
  message: 'Expected an ISO 8601 timestamp',
});

// Params. Malformed IDs are caught here to avoid generic "not founds"
const userIdParamSchema = z.object({ id: z.string().uuid() }).strict();

// audit_logs ids are ObjectIds, checked here for the same reason as user ids
const auditLogIdParamSchema = z
  .object({ id: z.string().regex(/^[0-9a-f]{24}$/i) })
  .strict();

// Filters shared by the audit table and the CSV export
const auditFilters = {
  category: z.enum(CATEGORIES).optional(),
  action: z.string().max(100).optional(),
  subjectId: z.string().uuid().optional(),
  // Only meaningful with subjectId, see AuditLog buildFilter
  subjectMode: z.enum(['all', 'actor', 'target', 'self']).optional(),
  from: timestamp.optional(),
  to: timestamp.optional(),
};

// Shared check so both schemas reject a backwards date range
const fromBeforeTo = (q) => !q.from || !q.to || q.from <= q.to;
const fromBeforeToMessage = { message: 'The start date must be before the end date.' };

const auditLogQuerySchema = z
  .object({
    ...pagination,

    // "true" lists held copies (audit_holds) instead of the live log
    held: z.enum(['true']).optional(),

    ...auditFilters,
  })
  .strict()
  .refine(fromBeforeTo, fromBeforeToMessage);

const userListQuerySchema = z
  .object({
    ...pagination,
    // Prevent overly long regex patterns
    search: z.string().trim().max(120).optional(),
    role: z.enum(ROLES).optional(),
  })
  .strict();

// Body for PATCH /admin/users/:id/role.
// admin <-> superadmin only: ordinary users are never promoted or demoted here
const updateRoleSchema = z
  .object({
    role: z.enum(['admin', 'superadmin']),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();

// Every admin action on an account carries a reason, same as a role change:
// it's the one part of the audit entry nothing else can reconstruct
const reason = z.string().trim().min(3).max(300);

const adminReasonSchema = z.object({ reason }).strict();

// Names only. Health fields stay the user's to edit, and email has no
// verification flow to change through
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

// The audit table's filters without paging; the export takes the whole match
const auditExportQuerySchema = z
  .object({ ...auditFilters })
  .strict()
  .refine(fromBeforeTo, fromBeforeToMessage);

// A note on an audit row. Plain text, shown as written
const auditNoteSchema = z.object({ body: z.string().trim().min(1).max(1000) }).strict();

module.exports = {
  userIdParamSchema,
  auditLogIdParamSchema,
  auditNoteSchema,
  auditLogQuerySchema,
  auditExportQuerySchema,
  userListQuerySchema,
  updateRoleSchema,
  adminReasonSchema,
  adminProfileSchema,
};