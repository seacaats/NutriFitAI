const { Router } = require('express');

const controller = require('../controllers/stepsController');
const { validateBody, validateQuery } = require('../middleware/validateMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const { stepSyncLimiter } = require('../middleware/rateLimitMiddleware');
const { todayQuerySchema, syncStepsSchema, stepRangeSchema, manualStepsSchema,
        stepSourceSchema } = require('../validators/stepsValidators');

const router = Router();



// Ownership comes form req.userId (signed token) so no authorization to another user
router.get(
  '/', 
  requireAuth, 
  validateQuery(stepRangeSchema), 
  controller.getSteps
);
router.get(
  '/today', 
  requireAuth, 
  validateQuery(todayQuerySchema), 
  controller.getToday
);

// Fires on every app foreground
router.post(
  '/sync', 
  requireAuth, 
  stepSyncLimiter, 
  validateBody(syncStepsSchema),
   controller.syncSteps
  );
router.post(
  '/manual', 
  requireAuth, 
  validateBody(manualStepsSchema), 
  controller.setManualSteps
);

router.patch(
  '/source', 
  requireAuth, 
  validateBody(stepSourceSchema), 
  controller.setStepSource
);

router.delete(
  '/source',
   requireAuth, 
   controller.clearStepSource
);

module.exports = router;
