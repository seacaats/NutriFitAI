const { Router } = require('express');
const multer = require('multer');

const controller = require('../controllers/workoutsController');
const { validateBody, validateQuery, validateParams } = require('../middleware/validateMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');
const {
  sessionRangeSchema, logSessionSchema, listQuerySchema, createRoutineSchema, updateRoutineSchema,
  logRoutineSessionSchema, favoriteSchema, favoriteParamsSchema, scheduleSchema, idParamSchema,
  rescheduleSchema, dayParamSchema, matchQuerySchema, createWorkoutSchema,
} = require('../validators/workoutValidators');

const router = Router();

// Upload to memory first as a buffer, like avatars
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

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
router.get('/equipment', requireAuth, controller.listEquipment);
router.get('/muscles', requireAuth, controller.listMuscles);
router.get('/match', requireAuth, validateQuery(matchQuerySchema), controller.matchWorkout);

router.post(
  '/sessions', 
  requireAuth, 
  validateBody(logSessionSchema), 
  controller.logSession
);
// Declared before /sessions/:id so "day" isn't read as an id
router.delete(
  '/sessions/day/:date', 
  requireAuth, 
  validateParams(dayParamSchema), 
  controller.deleteSessionsOnDay
);
router.delete(
  '/sessions/:id', 
  requireAuth, 
  validateParams(idParamSchema), 
  controller.deleteSession
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

// ---- Routines ----
// Also before /:id. "sessions" is declared before "/:id" below for the same reason
router.get(
  '/routines', 
  requireAuth, 
  controller.listRoutines
);
router.post(
  '/routines', 
  requireAuth, 
  validateBody(createRoutineSchema), 
  controller.createRoutine
);
router.post(
  '/routines/sessions', 
  requireAuth, 
  validateBody(logRoutineSessionSchema), 
  controller.logRoutineSession
);
router.get(
  '/routines/:id', 
  requireAuth, 
  validateParams(idParamSchema), 
  controller.getRoutine
);
router.patch(
  '/routines/:id',
  requireAuth,
  validateParams(idParamSchema),
  validateBody(updateRoutineSchema),
  controller.updateRoutine,
);
router.delete(
  '/routines/:id', 
  requireAuth, 
  validateParams(idParamSchema), 
  controller.deleteRoutine
);

// ---- Favorites (routines and single exercises) ----
router.get(
  '/favorites', 
  requireAuth, 
  controller.listFavorites
);
router.put(
  '/favorites', 
  requireAuth, 
  validateBody(favoriteSchema), 
  controller.addFavorite
);
router.delete(
  '/favorites/:kind/:refId',
  requireAuth,
  validateParams(favoriteParamsSchema),
  controller.removeFavorite,
);

// ---- Scheduling (next 7 days) ----
router.get(
  '/schedule', 
  requireAuth, 
  controller.listSchedule
);
router.post(
  '/schedule', 
  requireAuth, 
  validateBody(scheduleSchema), 
  controller.createSchedule
);
router.patch(
  '/schedule/:id',
  requireAuth,
  validateParams(idParamSchema),
  validateBody(rescheduleSchema),
  controller.reschedule
);
router.delete(
  '/schedule/:id', 
  requireAuth, 
  validateParams(idParamSchema), 
  controller.removeSchedule
);

router.get(
  '/', 
  requireAuth, 
  validateQuery(listQuerySchema),
   controller.listWorkouts
  );
router.post(
  '/', 
  requireAuth, 
  validateBody(createWorkoutSchema), 
  controller.createWorkout
);
router.post(
  '/:id/photo',
  requireAuth,
  photoUpload.single('photo'),
  controller.uploadWorkoutPhoto
);
router.get(
  '/:id', 
  requireAuth, 
  controller.getWorkout
);
router.delete(
  '/:id',
  requireAuth,
  controller.deleteWorkout
);

module.exports = router;