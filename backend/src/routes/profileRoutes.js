const { Router } = require('express');
const multer = require('multer');

const controller = require('../controllers/profileController');
const { validateBody } = require('../middleware/validateMiddleware');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { passwordCheckLimiter } = require('../middleware/rateLimitMiddleware');
const {
  updateProfileSchema, onboardingSchema, currentPasswordSchema, changePasswordSchema, deleteAccountSchema,
} = require('../validators/profileValidators');

const router = Router();

// Upload to memory first as a buffer
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

// Ownership comes form req.userId (signed token) so no authorization to another user
router.get(
  '/', 
  requireAuth, 
  controller.getProfile
);
router.patch(
  '/', 
  requireAuth, 
  validateBody(updateProfileSchema), 
  controller.updateProfile
);

// Setup wizard. User-only like the goals it writes (/steps, /water, /food)
router.put(
  '/onboarding',
  requireAuth,
  requireRole('user'),
  validateBody(onboardingSchema),
  controller.completeOnboarding
);

router.post(
  '/avatar', 
  requireAuth, 
  avatarUpload.single('avatar'),
  controller.uploadAvatar
);
router.delete(
  '/avatar', 
  requireAuth, 
  controller.removeAvatar
);

// Settings > change password. Limited per user, both steps take a password guess
router.post(
  '/password/verify',
  requireAuth,
  passwordCheckLimiter,
  validateBody(currentPasswordSchema),
  controller.verifyCurrentPassword
);
router.put(
  '/password',
  requireAuth,
  passwordCheckLimiter,
  validateBody(changePasswordSchema),
  controller.changePassword
);

// Settings > delete account. Same limiter, it takes a password guess too
router.delete(
  '/',
  requireAuth,
  passwordCheckLimiter,
  validateBody(deleteAccountSchema),
  controller.deleteAccount
);

module.exports = router;