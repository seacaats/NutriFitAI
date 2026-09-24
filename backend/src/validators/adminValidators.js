const { z } = require('zod');

const { ROLES } = require('../middleware/authMiddleware');
const { CATEGORIES } = require('../utils/auditActions');
const { MAX_PAGE_SIZE } = require('../models/AuditLog');

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

const auditLogQuerySchema = z
  .object({
    ...pagination,

    // Audit log filters
    category: z.enum(CATEGORIES).optional(),
    action: z.string().max(100).optional(),
    subjectId: z.string().uuid().optional(),

    from: timestamp.optional(),
    to: timestamp.optional(),
  })
  .strict()
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: '`from` must not be after `to`',
  });

const userListQuerySchema = z
  .object({
    ...pagination,
    // Prevent overly long regex patterns
    search: z.string().trim().max(120).optional(),
    role: z.enum(ROLES).optional(),
  })
  .strict();

// Body for PATCH /admin/users/:id/role.
const updateRoleSchema = z
  .object({
    role: z.enum(ROLES),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();

module.exports = {
  auditLogQuerySchema,
  userListQuerySchema,
  updateRoleSchema,
};
