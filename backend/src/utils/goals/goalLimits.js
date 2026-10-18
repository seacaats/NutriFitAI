// Goal limits and fallbacks shared by the water and steps screens, progress,
// reminders and the coach. Mirrored in the frontend's goalOptions.js

// One glass = 250 ml. The water goal is never set below 8 glasses
const GLASS_ML = 250;
const MIN_WATER_GOAL_ML = 8 * GLASS_ML;
const MAX_WATER_GOAL_ML = 4000;

// Step goal used until the user sets one
const DEFAULT_DAILY_STEP_GOAL = 10000;

module.exports = { GLASS_ML, MIN_WATER_GOAL_ML, MAX_WATER_GOAL_ML, DEFAULT_DAILY_STEP_GOAL };