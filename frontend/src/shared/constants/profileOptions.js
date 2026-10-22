/**
 * Field mappings and dropdown options:
 *   - GOALS values <-> backend src/utils/goalNormalizer.js's GOALS list
 *   - SEXES values <-> backend src/validators/shared/fieldSchemas.js's SEXES enum
 *   - ACTIVITY_LEVELS <-> backend accepts any value up to CUSTOM_OPTION_MAX (validators/shared/fieldSchemas.js)
 *
 * Goal and activity level also accept custom values (via OTHER_OPTION).
 */

// Label for the free-text fallback option on dropdowns
export const OTHER_OPTION = "Other";

// Max length of custom "Other" text for goal, activity level and diet.
// Mirrors CUSTOM_OPTION_MAX on the backend
export const CUSTOM_OPTION_MAX = 50;

export const GOALS = [
  { value: "lose-weight", label: "Lose Weight" },
  { value: "gain-weight", label: "Gain Weight" },
  { value: "maintain-weight", label: "Maintain Weight" },
  { value: "build-muscle", label: "Build Muscle" },
  { value: "improve-fitness", label: "Improve Fitness" },
];

// Biological sex options for metabolic calorie and BMR calculations
export const SEXES = ["Male", "Female"];

const SEX_VALUE_BY_LABEL = { Male: "male", Female: "female" };

const SEX_LABEL_BY_VALUE = Object.fromEntries(
  Object.entries(SEX_VALUE_BY_LABEL).map(([label, value]) => [value, label]),
);

export function sexLabelToValue(label) {
  return SEX_VALUE_BY_LABEL[label] || null;
}

export function sexValueToLabel(value) {
  return SEX_LABEL_BY_VALUE[value] || null;
}

// Display label for a goal slug from the API
export function goalValueToLabel(value) {
  const match = GOALS.find((g) => g.value === value);
  return match ? match.label : value || null;
}

export function goalLabelToValue(label) {
  const raw = String(label || "").trim();
  if (!raw) return null;
  const match = GOALS.find((g) => g.label === raw || g.value === raw);
  return match ? match.value : raw;
}

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary" },
  { value: "lightly-active", label: "Lightly Active" },
  { value: "moderately-active", label: "Moderately Active" },
  { value: "very-active", label: "Very Active" },
];

export function activityValueToLabel(value) {
  const match = ACTIVITY_LEVELS.find((a) => a.value === value);
  return match ? match.label : value || null;
}

export function activityLabelToValue(label) {
  const raw = String(label || "").trim();
  if (!raw) return null;
  const match = ACTIVITY_LEVELS.find((a) => a.label === raw || a.value === raw);
  return match ? match.value : raw;
}

// Dropdown label lists, each ending in "Other"
export const GOAL_OPTIONS = [...GOALS.map((g) => g.label), OTHER_OPTION];
export const ACTIVITY_OPTIONS = [...ACTIVITY_LEVELS.map((a) => a.label), OTHER_OPTION];

// Standard diet preferences. Mirrors DIET_PREFERENCES_MAX on the backend
export const NO_DIET_PREFERENCE = "No Preference";
export const DIET_PREFERENCES_MAX = 2000;

export const DIET_PREFERENCES = [
  "No Preference",
  "Balanced",
  "High Protein",
  "Low Carb",
  "Keto",
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Mediterranean",
  "Paleo",
  "Gluten-Free",
  "Dairy-Free",
  "Halal",
  "Kosher",
  OTHER_OPTION,
];

// Multi-select health conditions. "None" is mutually exclusive
export const NO_HEALTH_CONDITIONS = "None";

export const HEALTH_CONDITIONS = [
  NO_HEALTH_CONDITIONS,
  "Type 1 Diabetes",
  "Type 2 Diabetes",
  "Prediabetes",
  "High Blood Pressure",
  "High Cholesterol",
  "Heart Disease",
  "Asthma",
  "Thyroid Disorder",
  "PCOS",
  "Kidney Disease",
  "Arthritis / Joint Pain",
  "Food Allergies",
  "Lactose Intolerance",
  "Celiac Disease",
  "Pregnant / Breastfeeding",
  OTHER_OPTION,
];

// Conditions that only apply to one sex (by SEXES label)
const SEX_SPECIFIC_CONDITIONS = { PCOS: "Female", "Pregnant / Breastfeeding": "Female" };

// Options for a given sex. No sex given shows only universal conditions
export function healthConditionsFor(sex) {
  return HEALTH_CONDITIONS.filter((c) => !SEX_SPECIFIC_CONDITIONS[c] || SEX_SPECIFIC_CONDITIONS[c] === sex);
}

// Drops stored conditions that do not apply to the specified sex
export function pruneHealthConditions(value, sex) {
  const allowed = healthConditionsFor(sex);
  return String(value || "")
    .split(/\s*,\s*/)
    .filter((p) => p && (allowed.includes(p) || !HEALTH_CONDITIONS.includes(p)))
    .join(", ");
}

// Health conditions note for allergies and injuries in register and profile forms
export const HEALTH_CONDITIONS_NOTE = "Have a food allergy or an injury? Add it here so your coach knows. Pick Other to name it.";

// ---- Stored string <-> dropdown state helpers ---------------------------

// Single-select: a listed option, or "Other" with the value as custom text
export function splitChoice(value, options) {
  const raw = String(value || "").trim();
  if (!raw) return { choice: "", other: "" };
  if (raw !== OTHER_OPTION && options.includes(raw)) return { choice: raw, other: "" };
  return { choice: OTHER_OPTION, other: raw };
}

export function joinChoice(choice, other) {
  if (!choice) return "";
  return choice === OTHER_OPTION ? String(other || "").trim() : choice;
}

// Multi-select (health conditions), stored as comma-separated values
export function splitMulti(value, options) {
  const parts = String(value || "").split(/\s*,\s*/).filter(Boolean);
  const known = parts.filter((p) => p !== OTHER_OPTION && options.includes(p));
  const custom = parts.filter((p) => !options.includes(p));
  return {
    choices: custom.length ? [...known, OTHER_OPTION] : known,
    other: custom.join(", "),
  };
}

export function joinMulti(choices, other) {
  return choices
    .map((c) => (c === OTHER_OPTION ? String(other || "").trim() : c))
    .filter(Boolean)
    .join(", ");
}
