const { Router } = require('express');

const controller = require('../controllers/recommendationController');
const { validateBody, validateParams } = require('../middleware/validateMiddleware');
const { aiChatLimiter } = require('../middleware/rateLimitMiddleware');
const { recommendationIdParamSchema, recommendationUpdateSchema } = require('../validators/coachValidators');

const router = Router();

// Declared before /:id so "refresh" is not parsed as an id
router.get(
  '/',
  controller.listRecommendations
);
router.post(
  '/refresh',
  aiChatLimiter,
  controller.refreshRecommendations
);
router.get(
  '/:id/draft',
  validateParams(recommendationIdParamSchema),
  controller.draftRecommendation
);
router.patch(
  '/:id',
  validateParams(recommendationIdParamSchema),
  validateBody(recommendationUpdateSchema),
  controller.updateRecommendation
);

module.exports = router;