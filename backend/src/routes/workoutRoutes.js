const { Router } = require('express');

const controller = require('../controllers/workoutsController');
const { validateBody, validateQuery } = require('../middleware/validateMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const { sessionRangeSchema, logSessionSchema, listQuerySchema, CALENDAR_DAY } = require('../validators/workoutValidators')

const router = Router();

/**
 * Catalog reads are behind requireAuth even though nothing in them is
 * user-specific: an open list endpoint is free bandwidth for anyone who finds
 * it, and the 10 GB/7-day egress allowance is shared with everything else.
 */

// Declared BEFORE /:id, or "categories" and "sessions" parse as exercise ids
// and 400 on requests that should have worked.
router.get(
  '/categories', 
  requireAuth, 
  controller.listCategories
);

router.post(
  '/sessions', 
  requireAuth, 
  validateBody(logSessionSchema), 
  controller.logSession
);
router.get(
  '/sessions/summary', 
  requireAuth, 
  controller.sessionSummary
);
router.get(
  '/sessions', 
  requireAuth, 
  validateQuery(sessionRangeSchema),
   controller.listSessions
  );

router.get(
  '/', 
  requireAuth, 
  validateQuery(listQuerySchema),
   controller.listWorkouts
  );
router.get(
  '/:id', 
  requireAuth, 
  controller.getWorkout
);

module.exports = router;