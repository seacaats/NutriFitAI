const User = require('../../models/user/User');
const WeightLog = require('../../models/user/WeightLog');
const DailySteps = require('../../models/steps/DailySteps');
const WorkoutSession = require('../../models/workouts/WorkoutSession');
const Workout = require('../../models/workouts/Workout');
const WorkoutCategory = require('../../models/workouts/WorkoutCategory');
const FoodScan = require('../../models/food/FoodScan');
const Meal = require('../../models/food/Meal');
const WaterLog = require('../../models/water/WaterLog');
const { activityStreak } = require('../activityStreak');
const { today, dayRangeToInstants } = require('../../utils/calendarDay');

// Same defaults the dashboard shows when the user hasn't set a goal
// (progressController / waterController)
const DEFAULT_DAILY_STEPS = 10000;
const MIN_WATER_GOAL_ML = 2000;


// Data gets pre-aggregated into short human-readable lines rather than dumped as raw JSON

// Under-18 accounts exist in this database, so this is not hypothetical
const MINOR_AGE_THRESHOLD = 18;

const BASE_RULES = [
  'You are Nori, the NutriFitAI coach: a friendly, concrete fitness and nutrition assistant.',
  // The app shows replies as plain text; chatProvider strips any Markdown that slips through
  'Write plain text only. No Markdown: no asterisks, underscores, pound signs, backticks or tables. For a list, start each line with "• ".',
  // A hard number: larger models (Groq, Cerebras) read "short" loosely
  'Answer in plain language, under about 120 words: two or three short paragraphs at most, or a short list. Go longer only when the user asks for detail.',
  'Use the user data below when it is relevant. Never invent numbers that are not there.',
  'Today, goals and progress below are already in the user\'s own timezone. Compare progress against their targets when it helps.',
  'If a number is missing, say you do not have it yet and suggest how to log it.',
  'You are not a doctor. For symptoms, injuries, medication or diagnosis, say so and recommend a professional.',
  'Never recommend a daily intake below 1200 kcal, fasting beyond 24 hours, rapid weight loss, or training through pain.',
  'If the user expresses distress about their body, weight or eating, respond with warmth, avoid numeric targets entirely, ',
  'and gently point them toward someone they trust or a professional.',
  'Meal data only covers what the user logged. A day without meals means nothing was logged, not that they did not eat.',
];

const MINOR_RULES = [
  'Keep guidance to general healthy habits: balanced meals, sleep, hydration, enjoyable activity.',
  'Suggest involving a parent, guardian or school nurse for anything more specific.'
];

// Profile > coach tone. Style only: placed after the rules above, and told
// so, so a tone can never loosen a safety rule. Friendly is the default voice
const TONE_RULES = {
  direct: 'Tone: direct and to the point. Lead with the answer, skip pleasantries. Style only, every rule above still applies.',
  motivational: 'Tone: upbeat and encouraging. Celebrate progress and end with one small next step. Style only, every rule above still applies.',
};

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
  const [row] = await DailySteps.aggregate([
    { $match: { userId, activityDate: { $gte: daysAgo(6, timeZone) } } },
    {
      $group: {
        _id: null,
        daysWithData: { $sum: 1 },
        total: { $sum: '$stepCount' },
        average: { $avg: '$stepCount' },
        best: { $max: '$stepCount' },
        today: { $sum: { $cond: [{ $eq: ['$activityDate', today(timeZone)] }, '$stepCount', 0] } },
      },
    },
  ]);



  // Normalization to differentiate "daysWithData > 0" as no "data logged" instead of "logged zero"
  if (!row) return { daysWithData: 0, total: 0, average: 0, best: 0, today: 0 };

  return {
    daysWithData: row.daysWithData,
    today: row.today || 0,
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
        seconds: { $sum: { $ifNull: ['$actualDurationSeconds', 0] } },
      },
    },
  ]);

  return row
    ? { completed: row.completed, minutes: Math.round(row.seconds / 60) }
    : { completed: 0, minutes: 0 };
}

// The next planned session in the coming week, if any
async function nextPlannedWorkout(userId, timeZone) {
  const rows = await WorkoutSession.listUpcoming(userId, { until: new Date(Date.now() + 7 * 86400000) });
  const next = rows.find((w) => new Date(w.scheduledFor) > new Date());
  if (!next) return null;
  const when = new Date(next.scheduledFor).toLocaleString('en-US', {
    timeZone: timeZone || 'UTC', weekday: 'short', hour: 'numeric', minute: '2-digit',
  });
  return { name: next.routineName || next.exerciseName || 'a workout', kind: next.kind, when, count: rows.length };
}

// Water today and the daily average over the last 7 days, in ml
// "Chest, Legs; bodyweight only", or null without preferences. Names come
// from the catalog, the profile only holds wger ids
async function describeWorkoutPrefs(prefs) {
  const categoryIds = prefs?.categoryIds || [];
  const equipmentIds = prefs?.equipmentIds || [];
  if (!categoryIds.length && !prefs?.equipment) return null;

  const [categories, equipment] = await Promise.all([
    categoryIds.length ? WorkoutCategory.find({ _id: { $in: categoryIds } }, 'name').lean() : [],
    equipmentIds.length
      ? Workout.aggregate([
        { $unwind: '$equipment' },
        { $match: { 'equipment.id': { $in: equipmentIds } } },
        { $group: { _id: '$equipment.id', name: { $first: '$equipment.name' } } },
      ])
      : [],
  ]);

  const parts = [];
  if (categories.length) parts.push(categories.map((c) => c.name).join(', '));
  if (prefs.equipment === 'none') parts.push('bodyweight only');
  else if (prefs.equipment === 'any') {
    parts.push(equipment.length ? `has ${equipment.map((e) => e.name).join(', ')}` : 'has equipment');
  }
  return parts.length ? parts.join('; ') : null;
}

async function summariseWater(userId, timeZone) {
  const day = today(timeZone);
  const { start, end } = dayRangeToInstants(daysAgo(6, timeZone), day, timeZone);
  const totals = await WaterLog.dailyTotals(userId, start, end, timeZone);
  const days = Object.values(totals);
  return {
    today: totals[day] || 0,
    average: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0,
    daysWithData: days.length,
  };
}

// Direction of user data over the last month
async function summariseWeightTrend(userId) {
  const since = new Date(Date.now() - 30 * 86400000);

  const rows = await WeightLog.findSince(userId, since);

  if (rows.length < 2) return null;

  const delta = Number((rows[rows.length - 1].weightKg - rows[0].weightKg).toFixed(1));

  return {
    delta,
    direction: delta > 0.2 ? 'up' : delta < -0.2 ? 'down' : 'steady',
    readings: rows.length,
  };
}

// ---- Meals ---------------------------------------------------------------------

// "Adobong Manok, White Rice" or "Adobong Manok, White Rice +2 more"
function foodNames(items) {
  const names = [...new Set(items.map((i) => i.foodName))];
  return names.length > 3 ? `${names.slice(0, 2).join(', ')} +${names.length - 2} more` : names.join(', ');
}

function macros(x) {
  return `${fmt(Math.round(x.caloriesKcal || 0))} kcal, P ${x.proteinG ?? 0} g, C ${x.carbsG ?? 0} g, F ${x.fatG ?? 0} g`;
}

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Meal');

/**
 * Today's meals one by one, then calories per logged day for the last 7.
 * Same string-day window as summariseSteps, in the user's own timezone
 */
async function summariseMeals(userId, timeZone) {
  const day = today(timeZone);
  const rows = await Meal.listSince(userId, daysAgo(6, timeZone));

  const byDay = new Map();
  for (const meal of rows) {
    if (!byDay.has(meal.mealDate)) byDay.set(meal.mealDate, []);
    byDay.get(meal.mealDate).push(meal);
  }

  const facts = [];
  const todays = byDay.get(day) || [];
  if (todays.length) {
    const list = todays.map((m) => `${capitalize(m.mealType)} (${foodNames(m.items)}) ${fmt(Math.round(m.totals.caloriesKcal))} kcal`);
    facts.push(`Meals logged today: ${list.join('; ')}`);
    facts.push(`Logged today in total: ${macros(Meal.totalsOf(todays.flatMap((m) => m.items)))}`);
  } else {
    facts.push('Meals logged today: none yet');
  }

  if (byDay.size) {
    const perDay = [...byDay.entries()].map(([date, meals]) => [date, Meal.totalsOf(meals.flatMap((m) => m.items)).caloriesKcal]);
    const avg = Math.round(perDay.reduce((sum, [, kcal]) => sum + kcal, 0) / perDay.length);
    facts.push(
      `Calories logged, last 7 days: ${fmt(avg)}/day average over ${perDay.length} logged day(s) `
      + `(${perDay.map(([date, kcal]) => `${date}: ${fmt(Math.round(kcal))}`).join(', ')})`,
    );
  } else {
    facts.push('Meals: none logged in the last 7 days');
  }
  return facts;
}

// ---- Scan or meal in focus -------------------------------------------------------

/**
 * Loads what a thread is about, owner-checked. `ref` is { scanId } or
 * { mealId }. Null when there's no ref; { missing: true } when it was
 * deleted since, so the coach can say so instead of guessing
 */
async function loadSubject(userId, ref = {}) {
  if (ref.scanId) {
    const scan = await FoodScan.getOwned(String(ref.scanId), userId);
    return scan ? { kind: 'scan', doc: scan } : { kind: 'scan', missing: true };
  }
  if (ref.mealId) {
    const meal = await Meal.getOwned(String(ref.mealId), userId);
    return meal ? { kind: 'meal', doc: meal } : { kind: 'meal', missing: true };
  }
  return null;
}

/**
 * Short label for the chip the app pins above the chat. Built here so the
 * preview (before the first message) and a reopened thread read the same
 */
async function describeSubject(userId, ref, timeZone) {
  const subject = await loadSubject(userId, ref);
  if (!subject) return null;
  const id = String(ref.scanId || ref.mealId);
  if (subject.missing) return { kind: subject.kind, id, missing: true };

  const { doc } = subject;
  if (subject.kind === 'scan') {
    return {
      kind: 'scan',
      id,
      label: foodNames(doc.items) || 'No food recognised',
      // One serving of each food found, as on the scanner
      caloriesKcal: Math.round(doc.items.reduce((sum, i) => sum + (i.caloriesKcal || 0), 0)),
      date: today(timeZone, new Date(doc.scannedAt)),
    };
  }
  return {
    kind: 'meal',
    id,
    label: foodNames(doc.items),
    caloriesKcal: Math.round(doc.totals.caloriesKcal),
    mealType: doc.mealType,
    date: doc.mealDate,
  };
}

// The system-prompt block for the scan or meal a thread is about
function subjectSection(subject, timeZone) {
  if (!subject) return [];
  if (subject.missing) {
    return [
      '',
      `IN FOCUS: this chat was opened about a ${subject.kind === 'scan' ? 'food scan' : 'logged meal'} that has since been deleted.`,
      'If the user asks about it, say it is no longer available.',
    ];
  }

  const { doc } = subject;
  if (subject.kind === 'scan') {
    const lines = doc.items.map((i) => (i.caloriesKcal === null
      ? `- ${i.foodName}: no nutrition data`
      : `- ${i.foodName}${i.serving ? ` (${i.serving})` : ''}: ${macros(i)}`));
    return [
      '',
      `IN FOCUS: the user opened this chat about a food scan from ${today(timeZone, new Date(doc.scannedAt))}.`,
      'Assume their questions are about it unless they say otherwise.',
      'It has not been logged as a meal. Values are for ONE serving of each food detected:',
      ...(lines.length ? lines : ['- No food was recognised in the photo']),
    ];
  }

  // A logged meal: values are already multiplied out by servings
  const lines = doc.items.map((i) => {
    const portion = i.serving ? `${i.servings} x ${i.serving}` : `${i.servings} serving(s)`;
    return `- ${i.foodName} (${portion}): ${macros(i)}`;
  });
  return [
    '',
    `IN FOCUS: the user opened this chat about their ${doc.mealType || 'meal'} logged on ${doc.mealDate}.`,
    'Assume their questions are about it unless they say otherwise. Values below are for the portions they logged:',
    ...lines,
    `- Meal total: ${macros(doc.totals)}`,
  ];
}

/**
 * @param {string} userId
 * @param {{ scanId?: any, mealId?: any }} [ref] what the thread is about, if anything
 * @returns {Promise<{ system: string, isMinor: boolean }>}
 */
async function buildCoachContext(userId, ref = {}) {
  // Daily steps is based on user's profile so it's 
  // fetched first rather than with the Promise.all
  const user = await User.findById(userId, 'firstName profile').lean();
  const profile = user?.profile || null;
  const timeZone = profile?.timezone;
  const day = today(timeZone);

  const [goal, latestWeight, steps, workouts, weightTrend, mealFacts, subject, water, planned, streak, workoutPrefs] = await Promise.all([
    User.getActiveGoal(userId),
    WeightLog.findLatestByUserId(userId),
    summariseSteps(userId, timeZone),
    summariseWorkouts(userId),
    summariseWeightTrend(userId),
    summariseMeals(userId, timeZone),
    loadSubject(userId, ref),
    summariseWater(userId, timeZone),
    nextPlannedWorkout(userId, timeZone),
    activityStreak(userId, day, timeZone),
    describeWorkoutPrefs(profile?.workoutPrefs),
  ]);

  const isMinor = typeof profile?.age === 'number' && profile.age < MINOR_AGE_THRESHOLD;

  const facts = [];

  const weekday = new Date().toLocaleDateString('en-US', { timeZone: timeZone || 'UTC', weekday: 'long' });
  facts.push(`Today: ${weekday}, ${day}`);
  if (user?.firstName) facts.push(`First name: ${user.firstName}`);

  // Age band rather than exact age
  if (profile?.age) facts.push(`Age band: ${isMinor ? 'under 18' : '18 or over'}`);
  if (profile?.sex) facts.push(`Sex: ${profile.sex}`);
  if (profile?.heightCm) facts.push(`Height: ${profile.heightCm} cm`);
  if (latestWeight?.weightKg) facts.push(`Latest weight: ${latestWeight.weightKg} kg`);
  if (profile?.activityLevel) facts.push(`Activity level: ${profile.activityLevel}`);
  if (profile?.dietPreference) facts.push(`Diet preference: ${profile.dietPreference}`);
  if (profile?.healthConditions) facts.push(`Health notes: ${profile.healthConditions}`);
  // Weight targets are numbers the coach would repeat back, so a minor gets neither
  if (!isMinor && profile?.targetWeightKg) {
    const pace = profile.weeklyPaceKg ? `, aiming for about ${profile.weeklyPaceKg} kg a week` : '';
    facts.push(`Target weight: ${profile.targetWeightKg} kg${pace}`);
  }
  if (workoutPrefs) facts.push(`Workout preferences: ${workoutPrefs}`);

  if (goal?.fitnessGoal) facts.push(`Goal: ${goal.fitnessGoal}`);
  if (goal?.dailyCaloriesKcal) facts.push(`Daily calorie target: ${fmt(goal.dailyCaloriesKcal)} kcal`);
  const macroTargets = [['protein', goal?.dailyProteinG], ['carbs', goal?.dailyCarbsG], ['fat', goal?.dailyFatG]]
    .filter(([, g]) => g)
    .map(([name, g]) => `${name} ${fmt(g)} g`);
  if (macroTargets.length) facts.push(`Daily macro targets: ${macroTargets.join(', ')}`);
  const stepTarget = goal?.dailySteps ?? DEFAULT_DAILY_STEPS;
  const waterTarget = Math.max(goal?.dailyWaterMl ?? MIN_WATER_GOAL_ML, MIN_WATER_GOAL_ML);
  facts.push(`Daily step target: ${fmt(stepTarget)}${goal?.dailySteps ? '' : ' (default)'}`);
  facts.push(`Daily water target: ${fmt(waterTarget)} ml`);

  facts.push(`Steps today so far: ${fmt(steps.today)}`);
  if (steps.daysWithData > 0) {
    facts.push(
      `Steps, last 7 days: ${fmt(steps.average)}/day average over ${steps.daysWithData} logged day(s), best ${fmt(steps.best)}`,
    );
  } else {
    facts.push('Steps: no data logged in the last 7 days');
  }

  facts.push(`Water today so far: ${fmt(water.today)} ml`);
  if (water.daysWithData > 0) {
    facts.push(`Water, last 7 days: ${fmt(water.average)} ml/day average over ${water.daysWithData} logged day(s)`);
  }

  facts.push(workouts.completed > 0
    ? `Workouts completed in the last 7 days: ${workouts.completed} (${workouts.minutes} min total)`
    : 'Workouts completed in the last 7 days: none');
  if (planned) {
    facts.push(`Next planned workout: ${planned.name} (${planned.kind}), ${planned.when}; ${planned.count} planned this week`);
  }
  facts.push(`Logging streak: ${streak.days} day(s)${streak.loggedToday ? ', logged today' : ', nothing logged yet today'}`);

  if (weightTrend) {
    const word = weightTrend.direction === 'steady'
      ? 'held steady'
      : `${weightTrend.direction} ${Math.abs(weightTrend.delta)} kg`;
    facts.push(`Weight over the last 30 days: ${word} across ${weightTrend.readings} readings`);
  }

  facts.push(...mealFacts);

  const rules = [
    ...BASE_RULES,
    ...(isMinor ? MINOR_RULES : []),
    ...(TONE_RULES[profile?.coachTone] ? [TONE_RULES[profile.coachTone]] : []),
  ];

  const system = [
    rules.join('\n'),
    '',
    'USER DATA (from their NutriFitAI account):',
    facts.length > 0 ? facts.map((f) => `- ${f}`).join('\n') : '- No profile data recorded yet.',
    ...subjectSection(subject, timeZone),
  ].join('\n');

  return { system, isMinor };
}

module.exports = { buildCoachContext, describeSubject };