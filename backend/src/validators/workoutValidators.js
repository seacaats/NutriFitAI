const { z } = require('zod');
const { CALENDAR_DAY_RE } = require('../utils/calendarDay');

const listQuerySchema = z.object({
  category: z.coerce.number().int().positive().optional(),
  search: z.string().trim().min(1).max(100).optional(),
  hasImage: z.enum(['true', 'false']).optional(),
  equipment: z.string().regex(/^(none|any|\d+)$/, 'expected none, any or an equipment id').optional(),
  muscles: z.string().regex(/^\d+(,\d+){0,29}$/, 'expected comma-separated muscle ids').optional(),
  musclesSecondary: z.string().regex(/^\d+(,\d+){0,29}$/, 'expected comma-separated muscle ids').optional(),
  source: z.enum(['wger', 'user']).optional(),
  ids: z.string().regex(/^\d+(,\d+){0,199}$/, 'expected comma-separated ids').optional(),
  limit: z.coerce.number().int().positive().max(60).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  shuffle: z.coerce.number().int().min(1).max(8).optional(),
}).strict();

const matchQuerySchema = z.object({
  name: z.string().trim().min(1).max(150),
  excludeId: z.coerce.number().int().positive().optional(),
}).strict();

const createWorkoutSchema = z.object({
  name: z.string().trim().min(1, 'Please give the workout a name.').max(150, 'Workout name is too long.'),
  description: z.string().trim().max(1500, 'Description is too long.').nullable().optional(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  equipmentIds: z.array(z.coerce.number().int().positive()).max(10).optional(),
  muscleIds: z.array(z.coerce.number().int().positive()).max(15).optional(),
  secondaryMuscleIds: z.array(z.coerce.number().int().positive()).max(15).optional(),
  confirmDuplicate: z.boolean().optional(),
}).strict();

const updateWorkoutSchema = z.object({
  name: z.string().trim().min(1, 'Please give the workout a name.').max(150, 'Workout name is too long.').optional(),
  description: z.string().trim().max(1500, 'Description is too long.').nullable().optional(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  equipmentIds: z.array(z.coerce.number().int().positive()).max(10).optional(),
  muscleIds: z.array(z.coerce.number().int().positive()).max(15).optional(),
  secondaryMuscleIds: z.array(z.coerce.number().int().positive()).max(15).optional(),
  removePhoto: z.boolean().optional(),
  confirmDuplicate: z.boolean().optional(),
}).strict().refine((b) => Object.keys(b).length > 0, { message: 'There are no changes to save.' });

const CALENDAR_DAY = z.string().regex(CALENDAR_DAY_RE, 'expected YYYY-MM-DD');

const sessionRangeSchema = z.object({
  from: CALENDAR_DAY.optional(),
  to: CALENDAR_DAY.optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  days: z.coerce.number().int().positive().max(365).optional(),
  exerciseRef: z.coerce.number().int().positive().optional(),
}).strict();

const logSessionSchema = z.object({
  exerciseRef: z.coerce.number().int().positive(),
  exerciseName: z.string().trim().min(1).max(150),

  targetSets: z.coerce.number().int().min(1).max(20),
  targetReps: z.coerce.number().int().min(1).max(200),
  completedSets: z.coerce.number().int().min(0).max(20),

  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),

  // Cap duration at 6 hours to prevent backgrounded timers from skewing averages
  actualDurationSeconds: z.coerce.number().int().min(0).max(21600).optional(),

  status: z.enum(['completed', 'skipped']).default('completed'),

  plannedId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
}).strict();

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'invalid id');

// ---- Routines -------------------------------------------------------------

const routineExerciseSchema = z.object({
  exerciseRef: z.coerce.number().int().positive(),
  exerciseName: z.string().trim().min(1).max(150),
  targetSets: z.coerce.number().int().min(1).max(20).default(3),
  targetReps: z.coerce.number().int().min(1).max(200).default(10),
}).strict();

const routineFields = {
  title: z.string().trim().min(1, 'Please give the routine a name.').max(150, 'Routine name is too long.'),
  description: z.string().trim().max(500, 'Description is too long.').nullable().optional(),
  estimatedDurationMinutes: z.coerce.number().int().min(1).max(360).nullable().optional(),
  exercises: z.array(routineExerciseSchema)
    .min(1, 'Add at least one exercise.')
    .max(30, 'A routine can have up to 30 exercises.'),
};

const createRoutineSchema = z.object(routineFields).strict();

const updateRoutineSchema = z.object({
  title: routineFields.title.optional(),
  description: routineFields.description,
  estimatedDurationMinutes: routineFields.estimatedDurationMinutes,
  exercises: routineFields.exercises.optional(),
}).strict().refine((b) => Object.keys(b).length > 0, { message: 'There are no changes to save.' });

const logRoutineSessionSchema = z.object({
  routineId: objectId,
  completedSets: z.coerce.number().int().min(0).max(30),
  targetSets: z.coerce.number().int().min(1).max(30),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  actualDurationSeconds: z.coerce.number().int().min(0).max(21600).optional(),
  plannedId: objectId.optional(),
  exercises: z.array(z.object({
    position: z.coerce.number().int().min(0).max(29),
    completedSets: z.coerce.number().int().min(0).max(20),
    done: z.boolean(),
  }).strict()).max(30).optional(),
}).strict();

// ---- Favorites -------------------------------------------------------------

const favoriteSchema = z.object({
  kind: z.enum(['routine', 'exercise']),
  refId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(150),
}).strict();

const favoriteParamsSchema = z.object({
  kind: z.enum(['routine', 'exercise']),
  refId: z.string().trim().min(1).max(64),
}).strict();

// ---- Scheduling ------------------------------------------------------------

const scheduleSchema = z.object({
  kind: z.enum(['routine', 'exercise']),
  routineId: objectId.optional(),
  exerciseRef: z.coerce.number().int().positive().optional(),
  exerciseName: z.string().trim().min(1).max(150).optional(),
  targetSets: z.coerce.number().int().min(1).max(20).optional(),
  targetReps: z.coerce.number().int().min(1).max(200).optional(),
  scheduledFor: z.coerce.date(),
}).strict().refine(
  (b) => (b.kind === 'routine' ? Boolean(b.routineId) : Boolean(b.exerciseRef && b.exerciseName)),
  { message: 'A routine needs routineId; an exercise needs exerciseRef and exerciseName.' },
);

const idParamSchema = z.object({ id: objectId }).strict();

const dayParamSchema = z.object({ date: CALENDAR_DAY }).strict();

const rescheduleSchema = z.object({ scheduledFor: z.coerce.date() }).strict();

module.exports = {
  sessionRangeSchema,
  logSessionSchema,
  listQuerySchema,
  matchQuerySchema,
  createWorkoutSchema,
  updateWorkoutSchema,
  CALENDAR_DAY,
  createRoutineSchema,
  updateRoutineSchema,
  logRoutineSessionSchema,
  favoriteSchema,
  favoriteParamsSchema,
  scheduleSchema,
  idParamSchema,
  rescheduleSchema,
  dayParamSchema,
};
