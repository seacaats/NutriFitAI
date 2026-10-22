const { Router } = require('express');

const controller = require('../controllers/workouts');
const { validateBody, validateQuery, validateParams } = require('../middleware/validateMiddleware');
const { imageUpload, IMAGE_MAX_BYTES } = require('../middleware/uploadMiddleware');
const {
  sessionRangeSchema, logSessionSchema, listQuerySchema, createRoutineSchema, updateRoutineSchema,
  logRoutineSessionSchema, favoriteSchema, favoriteParamsSchema, scheduleSchema, idParamSchema,
  rescheduleSchema, dayParamSchema, matchQuerySchema, createWorkoutSchema, updateWorkoutSchema,
} = require('../validators/workoutValidators');

const router = Router();

const photoUpload = imageUpload(IMAGE_MAX_BYTES);

// Static sub-routes declared before /:id so they are not parsed as exercise ids
router.get(
  '/categories', 
  controller.listCategories
);
router.get('/equipment', controller.listEquipment);
router.get('/muscles', controller.listMuscles);
router.get('/match', validateQuery(matchQuerySchema), controller.matchWorkout);

router.post(
  '/sessions', 
  validateBody(logSessionSchema), 
  controller.logSession
);
// Declared before /sessions/:id so "day" is not parsed as an id
router.delete(
  '/sessions/day/:date', 
  validateParams(dayParamSchema), 
  controller.deleteSessionsOnDay
);
router.delete(
  '/sessions/:id', 
  validateParams(idParamSchema), 
  controller.deleteSession
);

router.get(
  '/sessions/summary', 
  controller.sessionSummary
);
router.get(
  '/sessions', 
  validateQuery(sessionRangeSchema),
   controller.listSessions
  );

// ---- Routines ----
router.get(
  '/routines', 
  controller.listRoutines
);
router.post(
  '/routines', 
  validateBody(createRoutineSchema), 
  controller.createRoutine
);
router.post(
  '/routines/sessions', 
  validateBody(logRoutineSessionSchema), 
  controller.logRoutineSession
);
router.get(
  '/routines/:id', 
  validateParams(idParamSchema), 
  controller.getRoutine
);
router.patch(
  '/routines/:id',
  validateParams(idParamSchema),
  validateBody(updateRoutineSchema),
  controller.updateRoutine,
);
router.delete(
  '/routines/:id', 
  validateParams(idParamSchema), 
  controller.deleteRoutine
);

// ---- Favorites (routines and single exercises) ----
router.get(
  '/favorites', 
  controller.listFavorites
);
router.put(
  '/favorites', 
  validateBody(favoriteSchema), 
  controller.addFavorite
);
router.delete(
  '/favorites/:kind/:refId',
  validateParams(favoriteParamsSchema),
  controller.removeFavorite,
);

// ---- Scheduling (next 7 days) ----
router.get(
  '/schedule', 
  controller.listSchedule
);
router.post(
  '/schedule', 
  validateBody(scheduleSchema), 
  controller.createSchedule
);
router.patch(
  '/schedule/:id',
  validateParams(idParamSchema),
  validateBody(rescheduleSchema),
  controller.reschedule
);
router.delete(
  '/schedule/:id', 
  validateParams(idParamSchema), 
  controller.removeSchedule
);

router.get(
  '/', 
  validateQuery(listQuerySchema),
   controller.listWorkouts
  );
router.post(
  '/', 
  validateBody(createWorkoutSchema), 
  controller.createWorkout
);
router.post(
  '/:id/photo',
  photoUpload.single('photo'),
  controller.uploadWorkoutPhoto
);
router.get(
  '/:id', 
  controller.getWorkout
);
router.patch(
  '/:id',
  validateBody(updateWorkoutSchema),
  controller.updateWorkout,
);
router.delete(
  '/:id',
  controller.deleteWorkout
);

module.exports = router;