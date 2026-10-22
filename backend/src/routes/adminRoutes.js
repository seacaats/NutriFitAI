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
  adminNoticeSchema,
  adminProfileSchema,
  auditNoteSchema,
  userIdParamSchema,
  auditLogIdParamSchema,
  imageReviewIdParamSchema,
  imageReviewQuerySchema,
  adminCreateUserSchema,
  sessionParamSchema,
} = require('../validators/adminValidators');

const router = Router();

// Enforce authentication, live role check, and admin role across all admin routes
router.use(requireAuth, requireFreshRole, requireRole('admin'));

const adminOnly = requireRole('admin');

// Image moderation queue
router.get(
  '/image-reviews',
  adminOnly,
  validateQuery(imageReviewQuerySchema),
  controller.listImageReviews,
);
router.get(
  '/image-reviews/:id/image',
  adminOnly,
  validateParams(imageReviewIdParamSchema),
  controller.viewImageReview,
);
router.post(
  '/image-reviews/:id/approve',
  adminOnly,
  validateParams(imageReviewIdParamSchema),
  validateBody(adminReasonSchema),
  controller.approveImageReview,
);
router.post(
  '/image-reviews/:id/remove',
  adminOnly,
  validateParams(imageReviewIdParamSchema),
  validateBody(adminReasonSchema),
  controller.removeImageReview,
);

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

router.post(
  '/users',
  adminOnly,
  validateBody(adminCreateUserSchema),
  controller.createUser,
);

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

router.post(
  '/users/:id/authenticator-reset',
  adminOnly,
  validateParams(userIdParamSchema),
  validateBody(adminReasonSchema),
  controller.resetUserAuthenticator,
);

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
  validateBody(adminNoticeSchema),
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

router.delete(
  '/users/:id',
  adminOnly,
  validateParams(userIdParamSchema),
  validateBody(adminNoticeSchema),
  controller.deleteUser,
);
router.post(
  '/users/:id/deletion/cancel',
  adminOnly,
  validateParams(userIdParamSchema),
  validateBody(adminReasonSchema),
  controller.cancelUserDeletion,
);

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

router.get(
  '/audit-logs/export',
  adminOnly,
  validateQuery(auditExportQuerySchema),
  controller.exportAuditLogs,
);

module.exports = router;