const { z } = require('zod');

const { ageSchema, sexSchema, personName, customOption, dietPreferences, healthConditions, passwordSchema } = require('./authValidators');
const { nutritionTargets } = require('./foodValidators');
const { stepGoalSchema } = require('./stepsValidators');
const { waterGoalSchema } = require('./waterValidators');

// `.nullable()` means "clear this field", `.optional()` means "leave it alone".
// Field rules are shared with registerSchema so the two can't drift apart.
// Only what registration leaves optional (last name, sex) can be cleared

// "22:00", 24-hour
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time like 22:00.');

// Sync with COACH_TONES in User.js
const COACH_TONES = ['friendly', 'direct', 'motivational'];

// Sent whole, so a partial object can't leave a switch undefined
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

// wger ids. Also sent whole: empty lists and a null equipment clear it
const wgerIds = z.array(z.number().int().positive()).max(50);
const workoutPrefsSchema = z
  .object({
    categoryIds: wgerIds,
    equipment: z.enum(['none', 'any']).nullable(),
    equipmentIds: wgerIds,
    // Optional, so a client from before muscle preferences can still save
    muscleIds: wgerIds.optional(),
    secondaryMuscleIds: wgerIds.optional(),
  })
  .strict();

// The setup wizard's fields that PATCH /profile can change later too
const preferenceFields = {
  workoutPrefs: workoutPrefsSchema.optional(),
  targetWeightKg: z.number()
    .min(20, 'Target weight must be at least 20 kg.')
    .max(500, 'Target weight can be up to 500 kg.')
    .nullable()
    .optional(),
  // 0.25-1 kg a week is the usual medical guidance; faster needs supervision
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
    // Required at sign-up: can be changed, not cleared
    age: ageSchema.optional(),
    sex: sexSchema.nullable().optional(),
    heightCm: z.number().positive().max(300).optional(),
    weightKg: z.number().positive().max(500).optional(),
    // Known slug or custom text, same as registration's "Other" option
    activityLevel: customOption('Activity level').optional(),
    // Multi-select, comma-joined like healthConditions
    dietPreference: dietPreferences.optional(),
    healthConditions: healthConditions.optional(),
    fitnessGoal: customOption('Fitness goal').optional(),
    timezone: z.string().trim().max(50).nullable().optional(),
    notificationsEnabled: z.boolean().optional(),
    notificationPrefs: notificationPrefsSchema.optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    ...preferenceFields,
  })
  .strict() // reject unknown keys rather than silently ignoring a typo'd field
  .refine((body) => Object.keys(body).length > 0, {
    message: 'There are no changes to save.',
  });

// PUT /profile/onboarding -- the setup wizard. Every field is optional: a
// skipped step is left out, and an empty body (Skip setup) is valid too.
// Goal limits are the same ones the Food, Steps and Water cards use
const onboardingSchema = z
  .object({
    ...nutritionTargets,
    dailySteps: stepGoalSchema.shape.dailySteps.optional(),
    dailyWaterMl: waterGoalSchema.shape.goalMl.optional(),
    notificationPrefs: notificationPrefsSchema.optional(),
    ...preferenceFields,
  })
  .strict();

// Settings > change password. The current one is checked on its own first,
// before the form is shown, then again on save
const currentPasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Please enter your current password.').max(200),
}).strict();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Please enter your current password.').max(200),
  newPassword: passwordSchema,
}).strict();

// Settings > delete account. Confirmed with the password and by typing DELETE
const deleteAccountSchema = z.object({
  currentPassword: z.string({ required_error: 'Please enter your current password.' }).min(1, 'Please enter your current password.').max(200),
  confirm: z.literal('DELETE'),
}).strict();

module.exports = {
  updateProfileSchema, onboardingSchema, currentPasswordSchema, changePasswordSchema, deleteAccountSchema,
};