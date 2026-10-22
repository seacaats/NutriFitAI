const { z } = require('zod');
const { CALENDAR_DAY_RE } = require('../utils/calendarDay');

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'invalid id');

const scanIdSchema = z.object({ id: objectId }).strict();

const DAY = z.string().regex(CALENDAR_DAY_RE, 'expected YYYY-MM-DD');

const scanPageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(30).optional(),
  before: z.string().datetime({ offset: true, message: 'expected an ISO timestamp' }).optional(),
}).strict();

const mealIdSchema = z.object({ id: objectId }).strict();

const mealHistorySchema = z.object({
  before: DAY.optional(),
  days: z.coerce.number().int().min(1).max(31).optional(),
}).strict();

// User-supplied per-100g macros when a recognized scan item lacks table nutrition data
const macro = (label) => z.coerce.number().min(0, `${label} can't be negative.`).max(5000).nullable().optional();

const mealItemSchema = z.object({
  scanItemId: objectId,
  grams: z.coerce.number({ invalid_type_error: 'Enter how many grams.' })
    .min(5, 'Enter at least 5 g.')
    .max(5000, 'Grams can be up to 5,000.'),
  servings: z.coerce.number().min(0.01).optional(),
  caloriesKcal: macro('Calories'),
  proteinG: macro('Protein'),
  carbsG: macro('Carbs'),
  fatG: macro('Fat'),
}).strict();

const logMealSchema = z.object({
  scanId: objectId,
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack'], {
    errorMap: () => ({ message: 'Pick breakfast, lunch, dinner or snack.' }),
  }),
  items: z.array(mealItemSchema)
    .min(1, 'Select at least one food.')
    .max(30, 'A meal can hold up to 30 foods.'),
}).strict();

const target = (label, unit, min, max) => {
  const range = `${label} must be between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')} ${unit}.`;
  return z.number({ invalid_type_error: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .min(min, range)
    .max(max, range)
    .nullable()
    .optional();
};

const nutritionTargets = {
  dailyCaloriesKcal: target('Calories', 'kcal', 1000, 5000),
  dailyProteinG: target('Protein', 'g', 1, 500),
  dailyCarbsG: target('Carbs', 'g', 1, 1000),
  dailyFatG: target('Fat', 'g', 1, 400),
};

const nutritionGoalsSchema = z.object(nutritionTargets)
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'There are no changes to save.' });

module.exports = {
  scanIdSchema, scanPageSchema, logMealSchema, mealIdSchema, mealHistorySchema, nutritionGoalsSchema, nutritionTargets,
};
