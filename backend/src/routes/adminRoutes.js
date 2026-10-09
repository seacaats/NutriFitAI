const { Router } = require('express');

const controller = require('../controllers/admin');
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
  auditExportQuerySchema,
  userListQuerySchema,
  updateRoleSchema,
  adminReasonSchema,
  adminProfileSchema,
  auditNoteSchema,
  userIdParamSchema,
  auditLogIdParamSchema,
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

// Floor for the whole router: nothing mounted here, now or later, is reachable
// below admin even if a route forgets its own check. Superadmin-only routes
// add superadminOnly on top
router.use(requireAuth, requireFreshRole, requireMinimumRole('admin'));

// ---------------------------------------------------------------------------
// Admin and above
// ---------------------------------------------------------------------------
const adminOnly = requireMinimumRole('admin');

// Counts across the app, no personal data (admin/analyticsController)
router.get(
  '/analytics',
  adminOnly,
  controller.getAnalytics,
);

router.get(
  '/users', 
  adminOnly, 
  validateQuery(userListQuerySchema), 
  controller.listUsers
);

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

// Notes on a row, admin and above. Holds are superadmin only (below)
router.get(
  '/audit-logs/:id/notes',
  adminOnly,
  validateParams(auditLogIdParamSchema),
  controller.listAuditNotes,
);
router.post(
  '/audit-logs/:id/notes',
  adminOnly,
  validateParams(auditLogIdParamSchema),
  validateBody(auditNoteSchema),
  controller.addAuditNote,
);

// Acting on an account. Rank is checked in the controller: an admin acts on
// users, a superadmin on users and admins, nobody on themselves
router.patch(
  '/users/:id/profile',
  adminOnly,
  validateParams(userIdParamSchema),
  validateBody(adminProfileSchema),
  controller.updateUserProfile,
);
router.post(
  '/users/:id/suspend',
  adminOnly,
  validateParams(userIdParamSchema),
  validateBody(adminReasonSchema),
  controller.suspendUser,
);
router.post(
  '/users/:id/reinstate',
  adminOnly,
  validateParams(userIdParamSchema),
  validateBody(adminReasonSchema),
  controller.reinstateUser,
);
router.post(
  '/users/:id/password-reset',
  adminOnly,
  validateParams(userIdParamSchema),
  validateBody(adminReasonSchema),
  controller.forcePasswordReset,
);
router.post(
  '/users/:id/password-reset/cancel',
  adminOnly,
  validateParams(userIdParamSchema),
  validateBody(adminReasonSchema),
  controller.cancelPasswordReset,
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

router.delete(
  '/users/:id',
  superadminOnly,
  validateParams(userIdParamSchema),
  validateBody(adminReasonSchema),
  controller.deleteUser,
);

// Keep a row past its expiry, or let it go
router.post(
  '/audit-logs/:id/hold',
  superadminOnly,
  validateParams(auditLogIdParamSchema),
  validateBody(adminReasonSchema),
  controller.holdAuditLog,
);
router.delete(
  '/audit-logs/:id/hold',
  superadminOnly,
  validateParams(auditLogIdParamSchema),
  validateBody(adminReasonSchema),
  controller.releaseAuditHold,
);

// CSV of every row matching the filters, unredacted
router.get(
  '/audit-logs/export',
  superadminOnly,
  validateQuery(auditExportQuerySchema),
  controller.exportAuditLogs,
);

module.exports = router;