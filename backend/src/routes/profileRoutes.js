const { Router } = require('express');

const controller = require('../controllers/profileController');
const { validateBody } = require('../middleware/validateMiddleware');
const { memoryUpload, IMAGE_MAX_BYTES } = require('../middleware/uploadMiddleware');
const { requireRole } = require('../middleware/authMiddleware');
const { passwordCheckLimiter } = require('../middleware/rateLimitMiddleware');
const {
  updateProfileSchema, onboardingSchema, currentPasswordSchema, changePasswordSchema, deleteAccountSchema,
} = require('../validators/profileValidators');

const router = Router();

const avatarUpload = memoryUpload(IMAGE_MAX_BYTES);

// Ownership comes form req.userId (signed token) so no authorization to another user
router.get(
  '/', 
  controller.getProfile
);
router.patch(
  '/', 
  validateBody(updateProfileSchema), 
  controller.updateProfile
);

// Setup wizard. User-only like the goals it writes (/steps, /water, /food)
router.put(
  '/onboarding',
  requireRole('user'),
  validateBody(onboardingSchema),
  controller.completeOnboarding
);

router.post(
  '/avatar', 
  avatarUpload.single('avatar'),
  controller.uploadAvatar
);
router.delete(
  '/avatar', 
  controller.removeAvatar
);

// Settings > change password. Limited per user, both steps take a password guess
router.post(
  '/password/verify',
  passwordCheckLimiter,
  validateBody(currentPasswordSchema),
  controller.verifyCurrentPassword
);
router.put(
  '/password',
  passwordCheckLimiter,
  validateBody(changePasswordSchema),
  controller.changePassword
);

// Settings > delete account. Same limiter, it takes a password guess too
router.delete(
  '/',
  passwordCheckLimiter,
  validateBody(deleteAccountSchema),
  controller.deleteAccount
);

module.exports = router;