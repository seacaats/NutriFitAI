const { Router } = require('express');

const controller = require('../controllers/profileController');
const { validateBody } = require('../middleware/validateMiddleware');
const { memoryUpload, IMAGE_MAX_BYTES } = require('../middleware/uploadMiddleware');
const { requireRole } = require('../middleware/authMiddleware');
const { passwordCheckLimiter, avatarUploadLimiter } = require('../middleware/rateLimitMiddleware');
const {
  updateProfileSchema, onboardingSchema, currentPasswordSchema, changePasswordSchema, deleteAccountSchema,
} = require('../validators/profileValidators');

const router = Router();

const avatarUpload = memoryUpload(IMAGE_MAX_BYTES);

router.get(
  '/', 
  controller.getProfile
);
router.patch(
  '/', 
  validateBody(updateProfileSchema), 
  controller.updateProfile
);

// Onboarding is restricted to regular users
router.put(
  '/onboarding',
  requireRole('user'),
  validateBody(onboardingSchema),
  controller.completeOnboarding
);

router.post(
  '/avatar', 
  avatarUploadLimiter,
  avatarUpload.single('avatar'),
  controller.uploadAvatar
);
router.delete(
  '/avatar', 
  controller.removeAvatar
);

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

router.delete(
  '/',
  passwordCheckLimiter,
  validateBody(deleteAccountSchema),
  controller.deleteAccount
);

module.exports = router;