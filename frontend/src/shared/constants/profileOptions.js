/**
 *   - GOALS values <-> backend src/utils/goalNormalizer.js's GOALS list
 *   - GENDER_VALUES <-> backend src/validators/authValidators.js's GENDERS enum
 *   - ACTIVITY_LEVELS <-> backend validators/profileValidators.js
 */

export const GOALS = [
  { value: "lose-weight", label: "Lose Weight" },
  { value: "gain-weight", label: "Gain Weight" },
  { value: "maintain-weight", label: "Maintain Weight" },
  { value: "build-muscle", label: "Build Muscle" },
  { value: "improve-fitness", label: "Improve Fitness" },
];

// Displayed on the gender pills; mapped to the backend's lowercase-slug enum on submit
export const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

const GENDER_VALUE_BY_LABEL = {
  Male: "male",
  Female: "female",
  Other: "other",
  "Prefer not to say": "prefer-not-to-say",
};

const GENDER_LABEL_BY_VALUE = Object.fromEntries(
  Object.entries(GENDER_VALUE_BY_LABEL).map(([label, value]) => [value, label]),
);

export function genderLabelToValue(label) {
  return GENDER_VALUE_BY_LABEL[label] || null;
}

export function genderValueToLabel(value) {
  return GENDER_LABEL_BY_VALUE[value] || null;
}

// Display label for a goal slug from the API (e.g. /auth/me's fitnessGoal)
export function goalValueToLabel(value) {
  const match = GOALS.find((g) => g.value === value);
  return match ? match.label : null;
}

export function goalLabelToValue(label) {
  const match = GOALS.find((g) => g.label === label || g.value === label);
  return match ? match.value : null;
}

// user_profiles.activity_level. Previously the profile screen treated this as
// "not stored by the backend yet" -- the column exists and is now persisted
export const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary" },
  { value: "lightly-active", label: "Lightly Active" },
  { value: "moderately-active", label: "Moderately Active" },
  { value: "very-active", label: "Very Active" },
];

export function activityValueToLabel(value) {
  const match = ACTIVITY_LEVELS.find((a) => a.value === value);
  return match ? match.label : null;
}

export function activityLabelToValue(label) {
  const match = ACTIVITY_LEVELS.find((a) => a.label === label || a.value === label);
  return match ? match.value : null;
}