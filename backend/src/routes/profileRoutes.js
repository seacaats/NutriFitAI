const { Router } = require('express');
const multer = require('multer');

const controller = require('../controllers/profileController');
const { validateBody } = require('../middleware/validateMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const { updateProfileSchema } = require('../validators/profileValidators');

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

module.exports = router;