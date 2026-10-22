/**
 * Daily goal limits and the onboarding's options, shared by the goal cards
 * (Food, Steps, Water), Profile, Settings and the wizard so they can't drift.
 *
 *   - NUTRITION_GOAL_FIELDS <-> backend validators/foodValidators.js's nutritionTargets
 *   - STEP_GOAL              <-> stepGoalSchema in stepsValidators.js
 *   - WATER_GOAL             <-> waterGoalSchema in waterValidators.js
 *   - COACH_TONES, TARGET_WEIGHT, WEEKLY_PACE <-> profileValidators.js
 */

// min/max mirror nutritionTargets in the backend's foodValidators.js
export const NUTRITION_GOAL_FIELDS = [
  { key: "dailyCaloriesKcal", label: "Calories", unit: "kcal", icon: "flame", tint: "orange", min: 1000, max: 5000 },
  { key: "dailyProteinG", label: "Protein", unit: "g", icon: "fish", tint: "green", min: 1, max: 500 },
  { key: "dailyCarbsG", label: "Carbs", unit: "g", icon: "nutrition", tint: "blue", min: 1, max: 1000 },
  { key: "dailyFatG", label: "Fat", unit: "g", icon: "water", tint: "purple", min: 1, max: 400 },
];

// "Calories must be between 1,000 and 5,000 kcal.", or "" when every filled field is in range
export function nutritionGoalProblem(values) {
  const bad = NUTRITION_GOAL_FIELDS.filter(
    (f) => values[f.key] && (Number(values[f.key]) < f.min || Number(values[f.key]) > f.max),
  );
  return bad
    .map((f) => `${f.label} must be between ${f.min.toLocaleString()} and ${f.max.toLocaleString()} ${f.unit}.`)
    .join("\n");
}

export const STEP_GOAL = { min: 1000, max: 50000, step: 500, default: 10000 };

// In glasses of GLASS_ML: 8 (2,000 ml) to 16 (4,000 ml). Recommended intake is
// about 2-3.7 L a day, so a goal stops at 4 L
export const GLASS_ML = 250;
export const WATER_GOAL = { minGlasses: 8, maxGlasses: 16 };
// One drink, and a whole day's total. Past 5 L a day is not recommended.
// Mirror MAX_DRINK_ML and MAX_DAY_ML in the backend's waterValidators.js
export const WATER_LIMITS = { maxDrinkMl: 1500, maxDayMl: 5000 };

export const TARGET_WEIGHT = { min: 20, max: 500 };

// kg a week, typed freely. 0.25-1 kg a week is the usual medical guidance
// for safe, lasting change (about 1% of body weight at most); faster than
// that needs supervision. Mirrors weeklyPaceKg in profileValidators.js
export const WEEKLY_PACE = { min: 0.1, max: 1 };
export const paceLabel = (kg) => (kg ? `${kg} kg / week` : null);

// "" when a typed target weight and pace (either may be empty) are fine
export function weightTargetProblem(targetText, paceText) {
  if (String(targetText ?? "").trim()) {
    const kg = Number(targetText);
    if (!Number.isFinite(kg) || kg < TARGET_WEIGHT.min || kg > TARGET_WEIGHT.max) {
      return `Target weight must be between ${TARGET_WEIGHT.min} and ${TARGET_WEIGHT.max} kg.`;
    }
  }
  if (String(paceText ?? "").trim()) {
    const kg = Number(paceText);
    if (!Number.isFinite(kg) || kg < WEEKLY_PACE.min || kg > WEEKLY_PACE.max) {
      return `Aim for ${WEEKLY_PACE.min} to ${WEEKLY_PACE.max} kg a week. Faster than that is best done with a doctor.`;
    }
  }
  return "";
}

// "" -> null, "0.5" -> 0.5
export const decimalOrNull = (text) => (String(text ?? "").trim() ? Number(text) : null);

// Grams of one food in a meal. Mirrors
// mealItemSchema in foodValidators.js
export const MIN_GRAMS = 5;
// Mirrors the grams limit in the backend's foodValidators.js
export const MAX_GRAMS = 5000;

export const COACH_TONES = [
  { value: "friendly", label: "Friendly", icon: "happy-outline", hint: "Warm and conversational." },
  { value: "direct", label: "Direct", icon: "flash-outline", hint: "Straight to the answer." },
  { value: "motivational", label: "Motivational", icon: "trophy-outline", hint: "Upbeat, with a next step." },
];
// No choice saved = the coach's usual voice
export const DEFAULT_COACH_TONE = "friendly";

export const NO_WORKOUT_PREFS = { categoryIds: [], equipment: null, equipmentIds: [], muscleIds: [], secondaryMuscleIds: [] };

// Rough daily calories (Mifflin-St Jeor x activity, nudged by the goal) to
// start the Calories field from. null when something it needs is missing,
// and for under-18s, who get no numeric targets from the app
const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  "lightly-active": 1.375,
  // 1.465 = exercise 4-5 times a week, the same value calculator.net uses;
  // 1.55 is for daily exercise, which the app has no level for
  "moderately-active": 1.465,
  "very-active": 1.725,
};
const GOAL_ADJUST = { "lose-weight": -500, "gain-weight": 300, "build-muscle": 250 };

// Same estimate as suggestCalories, with the steps shown to the user:
// { bmr, maintenance, adjust, kcal, bmi, heldAtMaintenance } (all kcal a day),
// or null when something it needs is missing
export function calorieEstimate({ age, sex, heightCm, weightKg, activityLevel, fitnessGoal }) {
  if (!age || age < 18 || !heightCm || !weightKg) return null;
  // Without a sex, halfway between the two constants
  const sexConstant = sex === "male" ? 5 : sex === "female" ? -161 : -78;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexConstant;
  // A custom activity level is treated as lightly active
  const maintenance = bmr * (ACTIVITY_FACTORS[activityLevel] || 1.375);
  const bmi = weightKg / (heightCm / 100) ** 2;
  // Someone already underweight is never told to eat less (the reference
  // calculator says the same: "you probably do not need to lose weight")
  const wantedAdjust = GOAL_ADJUST[fitnessGoal] || 0;
  const heldAtMaintenance = wantedAdjust < 0 && bmi < UNDERWEIGHT_BMI;
  const adjust = heldAtMaintenance ? 0 : wantedAdjust;
  // Never below 1,200, same floor the coach keeps to
  const kcal = Math.round(Math.max(1200, Math.min(5000, maintenance + adjust)) / 50) * 50;
  return { bmr: Math.round(bmr), maintenance: Math.round(maintenance), adjust, kcal, bmi, heldAtMaintenance };
}

const UNDERWEIGHT_BMI = 18.5;
const GOAL_PHRASES = {
  "lose-weight": "to lose weight gradually",
  "gain-weight": "to help you gain weight",
  "build-muscle": "to help you build muscle",
};

// Plain-language text for the recommendation banner:
// { headline, basis, steps: [{ label, value }], note }
export function describeCalorieEstimate(estimate, fitnessGoal) {
  if (!estimate) return null;
  const n = (v) => `${Math.abs(v).toLocaleString()} kcal`;
  const goalPhrase = estimate.adjust ? GOAL_PHRASES[fitnessGoal] : null;
  const steps = [
    { label: "What your body burns just staying alive", value: n(estimate.bmr) },
    { label: "What you burn in a typical day, with your activity", value: n(estimate.maintenance) },
  ];
  if (estimate.adjust) {
    steps.push({
      label: estimate.adjust > 0 ? "Extra to support your goal" : "Small daily reduction for your goal",
      value: `${estimate.adjust > 0 ? "+" : "-"}${n(estimate.adjust)}`,
    });
  }
  steps.push({ label: "Your suggested target", value: n(estimate.kcal) });
  return {
    headline: `About ${estimate.kcal.toLocaleString()} kcal a day`,
    basis: `Based on your age, height, weight and activity${goalPhrase ? `, ${goalPhrase}` : ", to keep your weight steady"}.`,
    steps,
    note: estimate.heldAtMaintenance
      ? "Your weight is already low for your height, so this keeps you at maintenance instead of cutting calories. A doctor or dietitian can give you personal advice."
      : "",
  };
}

export function suggestCalories(profile) {
  return calorieEstimate(profile)?.kcal ?? null;
}