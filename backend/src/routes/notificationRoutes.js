const { Router } = require('express');

const controller = require('../controllers/notificationController');
const { validateBody, validateQuery } = require('../middleware/validateMiddleware');
const {
  registerTokenSchema, revokeTokenSchema, inboxQuerySchema, markReadSchema,
} = require('../validators/notificationValidators');

// Mounted with requireAuth in routes/index.js. Every role gets an inbox:
// admins receive account notices too
const router = Router();

router.post(
  '/tokens',
  validateBody(registerTokenSchema),
  controller.registerToken
);
router.delete(
  '/tokens',
  validateBody(revokeTokenSchema),
  controller.revokeToken
);

router.get(
  '/',
  validateQuery(inboxQuerySchema),
  controller.listNotifications
);
router.post(
  '/read',
  validateBody(markReadSchema),
  controller.markRead
);

module.exports = router;