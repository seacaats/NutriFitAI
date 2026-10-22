const { z } = require('zod');

const { ageSchema, heightSchema, weightSchema, sexSchema, personName, customOption, dietPreferences, healthConditions, passwordSchema } = require('./shared/fieldSchemas');
const { nutritionTargets } = require('./foodValidators');
const { stepGoalSchema } = require('./stepsValidators');
const { waterGoalSchema } = require('./waterValidators');

// `.nullable()` clears a field; `.optional()` leaves it unchanged.

function isTimeZone(zone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 22:00.');

const COACH_TONES = ['friendly', 'direct', 'motivational'];

const notificationPrefsSchema = z
  .object({
    reminders: z.boolean(),
    achievements: z.boolean(),
    quietStart: clockTime.nullable(),
    quietEnd: clockTime.nullable(),
  })
  .strict()
  .refine((p) => (p.quietStart === null) === (p.quietEnd === null), {
    message: 'Quiet hours need both a start and an end time.',
  });

const wgerIds = z.array(z.number().int().positive()).max(50);
const workoutPrefsSchema = z
  .object({
    categoryIds: wgerIds,
    equipment: z.enum(['none', 'any']).nullable(),
    equipmentIds: wgerIds,
    muscleIds: wgerIds.optional(),
    secondaryMuscleIds: wgerIds.optional(),
  })
  .strict();

const preferenceFields = {
  workoutPrefs: workoutPrefsSchema.optional(),
  targetWeightKg: z.number()
    .min(20, 'Target weight must be at least 20 kg.')
    .max(500, 'Target weight can be up to 500 kg.')
    .nullable()
    .optional(),
  weeklyPaceKg: z.number()
    .min(0.1, 'Aim for at least 0.1 kg a week.')
    .max(1, 'Aim for at most 1 kg a week. Faster than that is best done with a doctor.')
    .nullable()
    .optional(),
  coachTone: z.enum(COACH_TONES).nullable().optional(),
};

const updateProfileSchema = z
  .object({
    firstName: personName('First name', { required: true }).optional(),
    lastName: personName('Last name').nullable().optional(),
    age: ageSchema.optional(),
    sex: sexSchema.nullable().optional(),
    heightCm: heightSchema.optional(),
    weightKg: weightSchema.optional(),
    activityLevel: customOption('Activity level').optional(),
    dietPreference: dietPreferences.optional(),
    healthConditions: healthConditions.optional(),
    fitnessGoal: customOption('Fitness goal').optional(),
    timezone: z.string().trim().max(50).refine(isTimeZone, 'Not a valid time zone.').nullable().optional(),
    notificationsEnabled: z.boolean().optional(),
    notificationPrefs: notificationPrefsSchema.optional(),
    ...preferenceFields,
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'There are no changes to save.',
  });

const onboardingSchema = z
  .object({
    ...nutritionTargets,
    dailySteps: stepGoalSchema.shape.dailySteps.optional(),
    dailyWaterMl: waterGoalSchema.shape.goalMl.optional(),
    notificationPrefs: notificationPrefsSchema.optional(),
    ...preferenceFields,
  })
  .strict();

const currentPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Please enter your current password.').max(200),
}).strict();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Please enter your current password.').max(200),
  newPassword: passwordSchema,
}).strict();

const deleteAccountSchema = z.object({
  currentPassword: z.string({ required_error: 'Please enter your current password.' }).min(1, 'Please enter your current password.').max(200),
  confirm: z.literal('DELETE'),
  code: z.string().min(1).max(30).optional(),
}).strict();

module.exports = {
  updateProfileSchema, onboardingSchema, currentPasswordSchema, changePasswordSchema, deleteAccountSchema,
};
