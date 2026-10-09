const { Router } = require('express');

const controller = require('../controllers/waterController');
const { validateBody, validateQuery, validateParams } = require('../middleware/validateMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  waterRangeSchema, logWaterSchema, waterGoalSchema, waterIdSchema, waterDayParamSchema, waterDaySchema,
} = require('../validators/waterValidators');

const router = Router();

// /goal is declared before /:id so it never parses as an entry id
router.get(
  '/', 
  requireAuth, 
  validateQuery(waterRangeSchema), 
  controller.getWater
);
router.post(
  '/', 
  requireAuth, 
  validateBody(logWaterSchema), 
  controller.logWater
);
router.put(
  '/goal', 
  requireAuth, 
  validateBody(waterGoalSchema), 
  controller.setWaterGoal
);
// One day's drinks, read and replaced as a whole by the day editor
router.get(
  '/day/:date', 
  requireAuth, 
  validateParams(waterDayParamSchema), 
  controller.getWaterDay
);
router.put(
  '/day/:date',
  requireAuth,
  validateParams(waterDayParamSchema),
  validateQuery(waterRangeSchema),
  validateBody(waterDaySchema),
  controller.setWaterDay
);
router.delete(
  '/:id', 
  requireAuth, 
  validateParams(waterIdSchema), 
  controller.removeWater
);

module.exports = router;