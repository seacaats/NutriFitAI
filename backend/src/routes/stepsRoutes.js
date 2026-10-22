const { Router } = require('express');

const controller = require('../controllers/stepsController');
const { validateBody, validateQuery } = require('../middleware/validateMiddleware');
const { stepSyncLimiter } = require('../middleware/rateLimitMiddleware');
const { todayQuerySchema, syncStepsSchema, stepRangeSchema, manualStepsSchema,
        stepSourceSchema, stepGoalSchema } = require('../validators/stepsValidators');

const router = Router();



router.get(
  '/', 
  validateQuery(stepRangeSchema), 
  controller.getSteps
);
router.get(
  '/today', 
  validateQuery(todayQuerySchema), 
  controller.getToday
);

router.post(
  '/sync', 
  stepSyncLimiter, 
  validateBody(syncStepsSchema),
   controller.syncSteps
  );
router.post(
  '/manual', 
  validateBody(manualStepsSchema), 
  controller.setManualSteps
);

router.put(
  '/goal',
  validateBody(stepGoalSchema),
  controller.setStepGoal
);

router.patch(
  '/source', 
  validateBody(stepSourceSchema), 
  controller.setStepSource
);

router.delete(
  '/source',
   controller.clearStepSource
);

module.exports = router;