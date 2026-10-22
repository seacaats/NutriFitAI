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
  requireRole,
} = require('../middleware/authMiddleware');
const {
  auditLogQuerySchema,
  auditExportQuerySchema,
  userListQuerySchema,
  adminReasonSchema,
  adminProfileSchema,
  auditNoteSchema,
  userIdParamSchema,
  auditLogIdParamSchema,
  adminCreateUserSchema,
  sessionParamSchema,
} = require('../validators/adminValidators');

const router = Router();

/**
 * The admin API.
 * 
 * requireAuth = who's making the request
 * requireFreshRole = what's that user's role
 * requireRole = is their role permitted
 * 
 */

// Floor for the whole router: nothing mounted here, now or later, is reachable
// below admin even if a route forgets its own check
router.use(requireAuth, requireFreshRole, requireRole('admin'));

const adminOnly = requireRole('admin');

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

// Notes and holds on a row. A hold keeps a row past its expiry, or lets it go
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

// Adds a regular or admin account. The person sets their own password (see the controller)
router.post(
  '/users',
  adminOnly,
  validateBody(adminCreateUserSchema),
  controller.createUser,
);

// Sessions: see a user's signed-in devices, end one or all of them
router.get(
  '/users/:id/sessions',
  adminOnly,
  validateParams(userIdParamSchema),
  controller.listUserSessions,
);
router.delete(
  '/users/:id/sessions/:sid',
  adminOnly,
  validateParams(sessionParamSchema),
  validateBody(adminReasonSchema),
  controller.revokeUserSession,
);
router.delete(
  '/users/:id/sessions',
  adminOnly,
  validateParams(userIdParamSchema),
  validateBody(adminReasonSchema),
  controller.revokeAllUserSessions,
);

// Clears another admin's authenticator so they set up a new one at their next sign-in
router.post(
  '/users/:id/authenticator-reset',
  adminOnly,
  validateParams(userIdParamSchema),
  validateBody(adminReasonSchema),
  controller.resetUserAuthenticator,
);

// Acting on an account. Nobody acts on themselves (checked in the controller)
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

// Schedules the deletion (see the controller), and takes it back
router.delete(
  '/users/:id',
  adminOnly,
  validateParams(userIdParamSchema),
  validateBody(adminReasonSchema),
  controller.deleteUser,
);
router.post(
  '/users/:id/deletion/cancel',
  adminOnly,
  validateParams(userIdParamSchema),
  validateBody(adminReasonSchema),
  controller.cancelUserDeletion,
);

// Keep a row past its expiry, or let it go
router.post(
  '/audit-logs/:id/hold',
  adminOnly,
  validateParams(auditLogIdParamSchema),
  validateBody(adminReasonSchema),
  controller.holdAuditLog,
);
router.delete(
  '/audit-logs/:id/hold',
  adminOnly,
  validateParams(auditLogIdParamSchema),
  validateBody(adminReasonSchema),
  controller.releaseAuditHold,
);

// CSV of every row matching the filters
router.get(
  '/audit-logs/export',
  adminOnly,
  validateQuery(auditExportQuerySchema),
  controller.exportAuditLogs,
);

module.exports = router;