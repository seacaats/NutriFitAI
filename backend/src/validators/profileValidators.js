const { z } = require('zod');

const { GENDERS } = require('./authValidators');

const ACTIVITY_LEVELS = ['sedentary', 'lightly-active', 'moderately-active', 'very-active'];

// `.nullable()` means "clear this field", `.optional()` means "leave it alone".

const updateProfileSchema = z
  .object({
    firstName: z.string().trim().max(75).nullable().optional(),
    lastName: z.string().trim().max(75).nullable().optional(),
    age: z.number().int().min(10).max(120).nullable().optional(),
    gender: z.enum(GENDERS).nullable().optional(),
    heightCm: z.number().positive().max(300).nullable().optional(),
    weightKg: z.number().positive().max(500).optional(),
    activityLevel: z.enum(ACTIVITY_LEVELS).nullable().optional(),
    dietPreference: z.string().trim().max(30).nullable().optional(),
    healthConditions: z.string().trim().max(2000).nullable().optional(),
    fitnessGoal: z.string().trim().min(1).max(50).nullable().optional(),
    timezone: z.string().trim().max(50).nullable().optional(),
    notificationsEnabled: z.boolean().optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
  })
  .strict() // reject unknown keys rather than silently ignoring a typo'd field
  .refine((body) => Object.keys(body).length > 0, {
    message: 'No changes were provided',
  });

module.exports = { updateProfileSchema, ACTIVITY_LEVELS };