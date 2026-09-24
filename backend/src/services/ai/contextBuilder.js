const UserGoal = require('../../models/user/UserGoal');
const UserProfile = require('../../models/user/UserProfile');
const WeightLog = require('../../models/user/WeightLog');
const { DailyStepsDoc, WorkoutSession, WeightLogDoc } = require('../../models/schemas');
const { today } = require('../../utils/calendarDay');


// Data gets pre-aggregated into short human-readable lines rather than dumped as raw JSON

// Under-18 accounts exist in this database, so this is not hypothetical
const MINOR_AGE_THRESHOLD = 18;

const BASE_RULES = [
  'You are the NutriFit AI coach: a friendly, concrete fitness and nutrition assistant.',
  'Answer in plain language. Two or three short paragraphs at most, or a short list.',
  'Use the user data below when it is relevant. Never invent numbers that are not there.',
  'If a number is missing, say you do not have it yet and suggest how to log it.',
  'You are not a doctor. For symptoms, injuries, medication or diagnosis, say so and recommend a professional.',
  'Never recommend a daily intake below 1200 kcal, fasting beyond 24 hours, rapid weight loss, or training through pain.',
  'If the user expresses distress about their body, weight or eating, respond with warmth, avoid numeric targets entirely, ',
  'and gently point them toward someone they trust or a professional.',
];

const MINOR_RULES = [
  'Keep guidance to general healthy habits: balanced meals, sleep, hydration, enjoyable activity.',
  'Suggest involving a parent, guardian or school nurse for anything more specific.'
];

// Minor formatting for numbers
function fmt(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : null;
}

// N days back from today, as a "YYYY-MM-DD" string
function daysAgo(n, timeZone) {
  const at = new Date(Date.now() - n * 86400000);
  return today(timeZone, at);
}

/**
 * The date bound is a STRING comparison, which is correct because "YYYY-MM-DD"
 * sorts lexicographically in the same order it sorts chronologically. The
 * boundary is computed as a string too -- never `new Date()` -- so the window
 * cannot silently shift by the server's UTC offset. Resolved in the user's
 * timezone when known, since "the last 7 days" means their week
 *
 * $match is indexed by { userId: 1, activityDate: 1 }, so the pipeline scans
 * only the range rather than the collection
 */
async function summariseSteps(userId, timeZone) {
  const [row] = await DailyStepsDoc.aggregate([
    { $match: { userId, activityDate: { $gte: daysAgo(6, timeZone) } } },
    {
      $group: {
        _id: null,
        daysWithData: { $sum: 1 },
        total: { $sum: '$stepCount' },
        average: { $avg: '$stepCount' },
        best: { $max: '$stepCount' },
      },
    },
  ]);



  // Normalization to differentiate "daysWithData > 0" as no "data logged" instead of "logged zero"
  if (!row) return { daysWithData: 0, total: 0, average: 0, best: 0 };

  return {
    daysWithData: row.daysWithData,
    total: row.total || 0,
    average: Math.round(row.average || 0),
    best: row.best || 0,
  };
}


// As an instant, a Date bound is used, unlike activityDate above
async function summariseWorkouts(userId) {
  const since = new Date(Date.now() - 7 * 86400000);

  const [row] = await WorkoutSession.aggregate([
    { $match: { userId, status: 'completed', completedAt: { $gte: since } } },
    {
      $group: {
        _id: null,
        completed: { $sum: 1 },
        calories: { $sum: { $ifNull: ['$caloriesBurnedKcal', 0] } },
      },
    },
  ]);

  return row ? { completed: row.completed, calories: row.calories } : { completed: 0, calories: 0 };
}

// Direction of user data over the last month
async function summariseWeightTrend(userId) {
  const since = new Date(Date.now() - 30 * 86400000);

  const rows = await WeightLogDoc.find(
    { userId, measuredAt: { $gte: since } },
    'weightKg measuredAt',
  )
    .sort({ measuredAt: 1 })
    .lean();

  if (rows.length < 2) return null;

  const delta = Number((rows[rows.length - 1].weightKg - rows[0].weightKg).toFixed(1));

  return {
    delta,
    direction: delta > 0.2 ? 'up' : delta < -0.2 ? 'down' : 'steady',
    readings: rows.length,
  };
}

/**
 * @param {string} userId
 * @returns {Promise<{ system: string, isMinor: boolean }>}
 */
async function buildCoachContext(userId) {
  // Daily steps is based on user's profile so it's 
  // fetched first rather than with the Promise.all
  const profile = await UserProfile.findByUserId(userId);
  const timeZone = profile?.timezone;

  const [goal, latestWeight, steps, workouts, weightTrend] = await Promise.all([
    UserGoal.findActiveByUserId(userId),
    WeightLog.findLatestByUserId(userId),
    summariseSteps(userId, timeZone),
    summariseWorkouts(userId),
    summariseWeightTrend(userId),
  ]);

  const isMinor = typeof profile?.age === 'number' && profile.age < MINOR_AGE_THRESHOLD;

  const facts = [];

  // Age band rather than exact age
  if (profile?.age) facts.push(`Age band: ${isMinor ? 'under 18' : '18 or over'}`);
  if (profile?.gender) facts.push(`Gender: ${profile.gender}`);
  if (profile?.heightCm) facts.push(`Height: ${profile.heightCm} cm`);
  if (latestWeight?.weightKg) facts.push(`Latest weight: ${latestWeight.weightKg} kg`);
  if (profile?.activityLevel) facts.push(`Activity level: ${profile.activityLevel}`);
  if (profile?.dietPreference) facts.push(`Diet preference: ${profile.dietPreference}`);
  if (profile?.healthConditions) facts.push(`Health notes: ${profile.healthConditions}`);

  if (goal?.fitnessGoal) facts.push(`Goal: ${goal.fitnessGoal}`);
  if (goal?.dailyCaloriesKcal) facts.push(`Daily calorie target: ${fmt(goal.dailyCaloriesKcal)} kcal`);
  if (goal?.dailySteps) facts.push(`Daily step target: ${fmt(goal.dailySteps)}`);
  if (goal?.weeklyWorkouts) facts.push(`Weekly workout target: ${goal.weeklyWorkouts}`);

  if (steps.daysWithData > 0) {
    facts.push(
      `Steps, last 7 days: ${fmt(steps.average)}/day average over ${steps.daysWithData} logged day(s), best ${fmt(steps.best)}`,
    );
  } else {
    facts.push('Steps: no data logged in the last 7 days');
  }

  if (workouts.completed > 0) {
    facts.push(`Workouts completed in the last 7 days: ${workouts.completed}`);
  }

  if (weightTrend) {
    const word = weightTrend.direction === 'steady'
      ? 'held steady'
      : `${weightTrend.direction} ${Math.abs(weightTrend.delta)} kg`;
    facts.push(`Weight over the last 30 days: ${word} across ${weightTrend.readings} readings`);
  }

  const rules = isMinor ? [...BASE_RULES, ...MINOR_RULES] : BASE_RULES;

  const system = [
    rules.join('\n'),
    '',
    'USER DATA (from their NutriFit account):',
    facts.length > 0 ? facts.map((f) => `- ${f}`).join('\n') : '- No profile data recorded yet.',
  ].join('\n');

  return { system, isMinor };
}

module.exports = { buildCoachContext, MINOR_AGE_THRESHOLD };