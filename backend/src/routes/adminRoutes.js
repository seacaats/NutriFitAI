const { Router } = require('express');
const { z } = require('zod');

const controller = require('../controllers/adminController');
const {
  validateBody,
  validateQuery,
  validateParams,
} = require('../middleware/validateMiddleware');
const {
  requireAuth,
  requireFreshRole,
  requireMinimumRole,
} = require('../middleware/authMiddleware');
const {
  auditLogQuerySchema,
  userListQuerySchema,
  updateRoleSchema,
} = require('../validators/adminValidators');

const router = Router();

/**
 * The admin and superadmin API.
 * 
 * requireAuth = who's making the request
 * requireFreshRole = what's that user's role
 * requireMinimumRole = is their role high enough to be permitted
 * 
 */

router.use(requireAuth, requireFreshRole);

// ---------------------------------------------------------------------------
// Admin and above
// ---------------------------------------------------------------------------
const adminOnly = requireMinimumRole('admin');

router.get(
  '/users', 
  adminOnly, 
  validateQuery(userListQuerySchema), 
  controller.listUsers
);

// Manually catch malformed IDs to avoid generic "not founds"
const userIdParamSchema = z.object({ id: z.string().uuid() }).strict();

router.get(
  '/users/:id', 
  adminOnly, 
  validateParams(userIdParamSchema), 
  controller.getUser
);
router.get(
  '/audit-logs', 
  adminOnly, 
  validateQuery(auditLogQuerySchema), 
  controller.listAuditLogs
);
router.get(
  '/audit-logs/meta',
  adminOnly,
  controller.getAuditMeta
);

// ---------------------------------------------------------------------------
// Superadmin only
// ---------------------------------------------------------------------------
const superadminOnly = requireMinimumRole('superadmin');

router.get(
  '/admins', 
  superadminOnly, 
  validateQuery(userListQuerySchema), 
  controller.listAdmins
);

// Granting and revoking privilege
router.patch(
  '/users/:id/role',
  superadminOnly,
  validateParams(userIdParamSchema),
  validateBody(updateRoleSchema),
  controller.updateUserRole,
);

module.exports = router;
