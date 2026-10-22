const { z } = require('zod');

const Recommendation = require('../models/recommendations/Recommendation');
const User = require('../models/user/User');
const Meal = require('../models/food/Meal');
const Workout = require('../models/workouts/Workout');
const WorkoutSession = require('../models/workouts/WorkoutSession');
// Its own chain, so recommendations never spend the chatbot's quota
const { chatRec: chat } = require('../services/ai/router');
const { buildCoachContext } = require('../services/ai/contextBuilder');
const { userTimeZone } = require('../services/user/userTimeZone');
const { today } = require('../utils/calendarDay');
const { sendSuccess, ApiError, asyncHandler } = require('../utils/httpResponse');
// The same table the food detection server answers from, so everything
// suggested here is something the scanner can recognise later
const FOODS = require('../../data/nutrition_data.json');

// Button per kind. A workout card carries its own route (its search)
const ACTIONS = {
  food: { label: 'Open Food Scanner', route: '/food-scanner' },
  workout: { label: 'See workout', route: '/workouts' },
  general: { label: 'Ask Nori', route: '/ai-coach' },
};

// Cards are cached for the day. Opening the dashboard regenerates them only
// once they are this old; the refresh button needs a pause and has a daily cap
const STALE_MS = 3 * 60 * 60 * 1000;
const REFRESH_COOLDOWN_MS = 60 * 60 * 1000;
const MAX_REFRESHES = 3;
// After a change that bears on the cards, the next dashboard open regenerates
// them, but no sooner than this since the last run, so a run of edits is one call
const CHANGED_MIN_MS = 2 * 60 * 1000;
const MAX_CARDS = 3;
// Candidates offered to the model per kind
const CANDIDATES = 5;
// A workout card is a routine: this many exercises, at least this many to be
// worth offering, and how many routines the model chooses from
const ROUTINE_SIZE = 5;
const MIN_ROUTINE = 3;
const ROUTINES = 2;
// Targets each exercise starts with (the routine's defaults)
const ROUTINE_SETS = 3;
const ROUTINE_REPS = 10;
// Workouts done in this window count as recently trained
const RECENT_WORKOUT_DAYS = 14;
// Same floor the coach keeps to
const MIN_KCAL = 1200;
// Shown instead of food picks when we can't judge them (under 18, a health
// condition or an unlisted diet): no figures, just a nudge to the coach
const FOOD_NUDGE = { kind: 'food', ref: 'food-ideas', title: 'Meals that suit your health needs', body: 'Ask Nori for ideas that fit.', detail: null, route: '/ai-coach' };
// Nothing below this is a meal or snack worth suggesting (garlic, lemon)
const MIN_FOOD_KCAL = 80;
const MAX_FOOD_KCAL = 700;
// Less than this left today and no food is suggested
const MIN_KCAL_LEFT = 150;

// Per user: when the cards were last generated and how many manual refreshes
// today. Covers a day with no cards, which leaves no row to read the time from
const runs = new Map();
// A second request for the same user joins the first, so one model call at most
const inflight = new Map();
// Users whose profile, goals, meals or workouts changed since the last run
const changed = new Set();

// Called by the controllers that save those. Cleared when the cards regenerate
function invalidateRecommendations(userId) {
  changed.add(userId);
}

function runOf(userId, day, rows) {
  const run = runs.get(userId);
  if (run && run.day === day) return run;
  const at = rows.reduce((latest, r) => Math.max(latest, new Date(r.createdAt).getTime()), 0);
  return { day, at, refreshes: 0 };
}

// ---- Food candidates -------------------------------------------------------------

// The table has no diet tags, so these match on the food's name. They only
// ever remove foods; a diet or condition they can't judge gets no food cards
const MEAT = /baboy|manok|beef|pork|chicken|bacon|\bham\b|sausage|steak|lechon|longganisa|tocino|tapa|spam|corn beef|hot ?dog|sisig|bulalo|nilaga|pares|pata|dinuguan|embutido|menudo|caldereta|igado|kare kare|bicol|afritada|tinola|inasal|bistek|bbq|nugget|wing|meat|burger|cordon|shawarma|carbonara|lasagna|pastil|arozcaldo|dinakdakan|pigar|binagoongan|siomai|kikiam|fish ball|hungarian/i;
const FISH = /bangus|pusit|tilapia|fish|shrimp|shripm|seafood|takoyaki|tempura|squid/i;
const EGG_DAIRY = /egg|omelet|cheese|milk|yogurt|ice cream|cream|butter|leche flan|tiramisu|pancake|waffle|muffin|halo halo|taho|latte|champorado|kwek/i;
const DAIRY = /cheese|milk|yogurt|ice cream|cream|butter|leche flan|tiramisu|halo halo|taho|latte|carbonara|lasagna/i;
const GLUTEN = /bread|pasta|spaghetti|noodle|pancit|palabok|pizza|cake|pancake|waffle|croissant|muffin|doughnut|\bpie\b|sandwich|burger|nugget|tempura|lasagna|tortilla|tacos|nachos|graham|pandesal|siomai|lumpia|empanada|cordon|carbonara|mac |oatmeal/i;
const PORK = /baboy|pork|bacon|\bham\b|sausage|longganisa|tocino|spam|lechon|sisig|dinuguan|embutido|hot ?dog|hungarian|bicol|pata|dinakdakan|binagoongan|carbonara|menudo|siomai|kikiam|shanghai/i;

// Each diet preference as a test on one food. Listed: nothing to remove.
// A preference not listed here (Kosher, Paleo, a typed one) can't be checked
const DIET_TESTS = {
  'No Preference': () => true,
  Balanced: () => true,
  'High Protein': () => true,
  Mediterranean: () => true,
  Vegetarian: (f) => !MEAT.test(f.label) && !FISH.test(f.label) || /tofu/i.test(f.label),
  Vegan: (f) => (!MEAT.test(f.label) && !FISH.test(f.label) && !EGG_DAIRY.test(f.label)) || /tofu/i.test(f.label),
  Pescatarian: (f) => !MEAT.test(f.label) || /tofu/i.test(f.label),
  Halal: (f) => !PORK.test(f.label),
  'Gluten-Free': (f) => !GLUTEN.test(f.label),
  'Dairy-Free': (f) => !DAIRY.test(f.label),
  'Low Carb': (f) => f.carbs <= 25,
  Keto: (f) => f.carbs <= 15,
  Kosher: (f) => !PORK.test(f.label) && !/shrimp|shripm|squid|pusit|seafood|takoyaki/i.test(f.label),
  Paleo: (f) => !GLUTEN.test(f.label) && !DAIRY.test(f.label),
};

const clean = (name) => String(name).replace(/_/g, ' ');

const foodRows = FOODS.map((f) => ({
  id: f.id,
  label: clean(f.name),
  title: f.display_name ? clean(f.display_name) : clean(f.name),
  serving: f.serving,
  estimated: Boolean(f.portion_estimated),
  kcal: f.calories_kcal,
  protein: f.protein_g,
  carbs: f.carbs_g,
  fat: f.fats_g,
}));

// null when this person gets no food cards at all
function dietTest(profile) {
  // Any condition or allergy: general advice only, the coach handles those
  const conditions = String(profile?.healthConditions || '').trim();
  if (conditions && conditions !== 'None') return null;

  const prefs = String(profile?.dietPreference || '').split(/\s*,\s*/).filter(Boolean);
  const tests = [];
  for (const pref of prefs) {
    if (!DIET_TESTS[pref]) return null;
    tests.push(DIET_TESTS[pref]);
  }
  return (food) => tests.every((t) => t(food));
}

// Why this food, from what they have eaten today. Figures come from the data
function foodReason(f, { hasGoal, goal, eaten, proteinLeft }) {
  if (!hasGoal) return `A serving gives you ${f.protein} g of protein.`;
  return `You've had ${Math.round(eaten.caloriesKcal)} of ${goal.dailyCaloriesKcal} kcal today, and this adds ${f.protein} g of protein${proteinLeft > 0 ? ' toward your goal' : ''}.`;
}

// True when this person gets the nudge instead of food picks
const needsNudge = (profile, isMinor) => isMinor || !dietTest(profile);

// Foods that fit what is left of today's calories, richest in protein first.
// Without a calorie goal there is no "left today", so the diet alone decides.
// Never for under-18s, who get no figures
function foodCandidates({ profile, goal, eaten, loggedNames, isMinor }) {
  const test = dietTest(profile);
  if (isMinor || !test) return [];

  const hasGoal = Boolean(goal?.dailyCaloriesKcal);
  const kcalLeft = hasGoal ? goal.dailyCaloriesKcal - eaten.caloriesKcal : Infinity;
  if (kcalLeft < MIN_KCAL_LEFT) return [];
  const proteinLeft = goal.dailyProteinG ? Math.max(0, goal.dailyProteinG - eaten.proteinG) : 0;

  return foodRows
    .filter((f) => f.kcal >= MIN_FOOD_KCAL && f.kcal <= Math.min(kcalLeft, MAX_FOOD_KCAL))
    .filter((f) => test(f) && !loggedNames.has(f.label.toLowerCase()))
    // A little jitter, so a refresh doesn't offer the same five
    .map((f) => ({ f, score: ((proteinLeft > 0 || !hasGoal ? f.protein / f.kcal : 1 / f.kcal) * (0.8 + Math.random() * 0.4)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, CANDIDATES)
    .map(({ f }) => ({
      ref: `f${f.id}`,
      kind: 'food',
      title: f.title.slice(0, 60),
      detail: `${f.estimated ? 'About ' : ''}${f.serving} · ${f.kcal} kcal · P ${f.protein} g · C ${f.carbs} g · F ${f.fat} g`.slice(0, 160),
      route: null,
      reason: foodReason(f, { hasGoal, goal, eaten, proteinLeft }),
    }));
}

// ---- Workout candidates ----------------------------------------------------------

const NO_EQUIPMENT = /^none/i;
const names = (list) => (list || []).map((x) => x.name).filter(Boolean);

// The catalog names muscles anatomically (Anterior deltoid); the cards talk in
// broad groups. Order matters: Biceps femoris is a leg, not Biceps
const MUSCLE_GROUPS = [
  [/femoris|gastrocnemius|soleus|quadriceps|calf|hamstring/i, 'Legs'],
  [/biceps|brachialis/i, 'Biceps'],
  [/triceps/i, 'Triceps'],
  [/deltoid|shoulder/i, 'Shoulders'],
  [/pectoralis|serratus|chest/i, 'Chest'],
  [/latissimus|trapezius|rhomboid|back/i, 'Back'],
  [/abdominis|obliq|core/i, 'Core'],
  [/gluteus|glute/i, 'Glutes'],
];
const groupsOf = (muscles) => [...new Set(names(muscles).map((n) => MUSCLE_GROUPS.find(([re]) => re.test(n))?.[1]).filter(Boolean))];
// "Chest", "Chest and Back", "Chest, Back and Core"
const sayList = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] || '');

// Routines built from the catalog (and their own workouts) that match the
// user's saved preferences, favouring muscles they haven't trained lately and
// skipping what they just did
async function workoutCandidates(userId, profile) {
  const prefs = profile?.workoutPrefs || {};
  const and = [Workout.visibleTo(userId), { $or: [{ hasRealImage: true }, { source: 'user' }] }];
  if (prefs.categoryIds?.length) and.push({ 'category.id': { $in: prefs.categoryIds } });
  if (prefs.equipment === 'none') {
    and.push({ $or: [{ equipment: { $size: 0 } }, { 'equipment.name': NO_EQUIPMENT }] });
  } else if (prefs.equipment === 'any') {
    and.push(prefs.equipmentIds?.length
      ? { 'equipment.id': { $in: prefs.equipmentIds } }
      : { equipment: { $elemMatch: { name: { $not: NO_EQUIPMENT } } } });
  }
  if (prefs.muscleIds?.length || prefs.secondaryMuscleIds?.length) {
    and.push({ $or: [{ 'muscles.id': { $in: prefs.muscleIds || [] } }, { 'musclesSecondary.id': { $in: prefs.secondaryMuscleIds || [] } }] });
  }

  const since = new Date(Date.now() - RECENT_WORKOUT_DAYS * 86400000);
  const { sessions } = await WorkoutSession.findRecent(userId, { limit: 50, since });
  const doneRefs = new Set(sessions.flatMap((s) => [s.exerciseRef, ...(s.exercises || []).map((e) => e.exerciseRef)]).filter(Boolean));
  // The muscle groups they trained in that window
  const trained = new Set(
    (doneRefs.size ? await Workout.find({ _id: { $in: [...doneRefs] } }, 'muscles').lean() : [])
      .flatMap((w) => groupsOf(w.muscles)),
  );

  const pool = await Workout.aggregate([
    { $match: { $and: and } },
    { $sample: { size: 40 } },
    { $project: { name: 1, category: 1, muscles: 1, equipment: 1 } },
  ]);

  const ranked = pool
    .filter((w) => !doneRefs.has(w._id))
    // Groups they haven't trained lately rank higher, with some chance so a
    // refresh doesn't always offer the same routine
    .map((w) => ({ w, fresh: groupsOf(w.muscles).filter((g) => !trained.has(g)).length + Math.random() }))
    .sort((a, b) => b.fresh - a.fresh);

  // The ranked list cut into routines. A short remainder isn't a routine
  const routines = [];
  for (let i = 0; i < ranked.length && routines.length < ROUTINES; i += ROUTINE_SIZE) {
    const group = ranked.slice(i, i + ROUTINE_SIZE);
    if (group.length >= MIN_ROUTINE) routines.push(group);
  }

  const n = sessions.length;
  return routines.map((group) => {
    // The groups the routine hits most, for its name
    const count = {};
    group.forEach(({ w }) => groupsOf(w.muscles).forEach((g) => { count[g] = (count[g] || 0) + 1; }));
    const focus = Object.entries(count).sort((a, b) => b[1] - a[1]).map(([g]) => g);
    const equipment = [...new Set(group.flatMap(({ w }) => names(w.equipment)).filter((e) => !NO_EQUIPMENT.test(e)))];
    // Groups in it they haven't trained lately: a suggestion, never a gap
    const added = focus.filter((g) => !trained.has(g)).slice(0, 3);
    let reason;
    if (!n) reason = 'A simple way to get moving again.';
    else if (added.length) reason = `You've done ${n} workout${n === 1 ? '' : 's'} in the last ${RECENT_WORKOUT_DAYS} days, so this adds some ${sayList(added)} work for variety.`;
    else reason = `You've done ${n} workout${n === 1 ? '' : 's'} in the last ${RECENT_WORKOUT_DAYS} days, and this keeps the variety going.`;
    return {
      // The first exercise and the size, enough to tell two routines apart
      ref: `r${group[0].w._id}x${group.length}`,
      kind: 'workout',
      title: (focus.length ? `${sayList(focus.slice(0, 2))} routine` : 'Full body routine').slice(0, 60),
      // Cut to the stored limit
      detail: [`${group.length} exercises`, focus.slice(0, 3).join(', '), equipment.length ? equipment.slice(0, 3).join(', ') : 'No equipment'].filter(Boolean).join(' · ').slice(0, 160),
      route: null,
      reason,
      // For the model only, never stored
      hint: n ? `they did ${n} workouts in ${RECENT_WORKOUT_DAYS} days, mostly ${sayList([...trained].slice(0, 4)) || 'mixed'}` : 'no workouts logged lately',
      exercises: group.map(({ w }) => ({ exerciseRef: w._id, exerciseName: w.name.slice(0, 150), targetSets: ROUTINE_SETS, targetReps: ROUTINE_REPS })),
    };
  });
}

// ---- AI ----------------------------------------------------------------------------

const aiCardsSchema = z
  .array(z.object({
    kind: z.enum(Recommendation.KINDS),
    ref: z.string().max(20).nullable().optional(),
    title: z.string().trim().min(1).max(60),
    body: z.string().trim().min(1).max(160),
  }))
  .min(1)
  .max(MAX_CARDS);

const line = (c) => `- ${c.ref}: ${c.title} (${c.detail})${c.hint ? ` [${c.hint}]` : ''}`;

// Whole sentences: single spaces, a capital first letter and an end mark. A
// title keeps no end mark
function tidy(text, sentence = true) {
  let t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return t;
  t = t[0].toUpperCase() + t.slice(1);
  return sentence ? (/[.!?]$/.test(t) ? t : `${t}.`) : t.replace(/[.!?]+$/, '');
}

// The model's picks, joined to the candidate they point at. Figures always
// come from the data, so a food or workout card whose text has digits gets
// the standard reason instead. null when nothing usable came back
function parseAiCards(text, candidates, isMinor) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end <= start) return null;
  let parsed;
  try {
    parsed = aiCardsSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
  } catch {
    return null;
  }
  if (!parsed.success) return null;

  const byRef = new Map(candidates.map((c) => [c.ref, c]));
  const cards = [];
  for (const card of parsed.data) {
    if (card.kind === 'general') {
      const words = `${card.title} ${card.body}`;
      // Nothing below the calorie floor, and no figures for under-18s
      const kcal = [...words.matchAll(/(\d[\d,]*)\s*kcal/gi)].map((m) => Number(m[1].replace(/,/g, '')));
      if (kcal.some((n) => n < MIN_KCAL)) continue;
      if (isMinor && /\d+\s*(kcal|kg|lb)/i.test(words)) continue;
      cards.push({ kind: 'general', title: tidy(card.title, false), body: tidy(card.body), detail: null, ref: null, route: null });
      continue;
    }
    const pick = byRef.get(card.ref);
    if (!pick || pick.kind !== card.kind) continue;
    const clear = !/\d/.test(`${card.title} ${card.body}`);
    // A short lead-in from the model, then the line built from their data
    const lead = clear && card.body.length <= 120 ? tidy(card.body) : '';
    cards.push({ kind: pick.kind, title: clear ? tidy(card.title, false) : pick.title, body: [lead, tidy(pick.reason)].filter(Boolean).join(' ').slice(0, 240), detail: pick.detail, ref: pick.ref, route: pick.route, exercises: pick.exercises });
  }
  return cards.length ? cards : null;
}

// The coach's own context (same data, same safety rules) plus the candidates
// and the task. null on any failure, so the plain picks are used instead
async function aiCards(context, candidates) {
  const foods = candidates.filter((c) => c.kind === 'food');
  const workouts = candidates.filter((c) => c.kind === 'workout');
  const system = [
    context.system,
    '',
    'TASK: choose up to 3 recommendations for the dashboard, using the user data above and ONLY the candidates below.',
    'Reply with ONLY a JSON array and nothing else: [{"kind":"food|workout|general","ref":"f12","title":"2 to 5 words","body":"one friendly sentence"}]',
    'A food or workout card must use a ref from the lists below, with the same kind. At most 1 food and 1 workout (each workout candidate is a routine of several exercises). Skip a list only if it is empty.',
    'Tone: warm and encouraging, like a coach making a suggestion. Offer ideas ("you could try", "a good way to"), never scold, and never point out what they skipped or missed.',
    'Food: tie the pick to their diet and what they have eaten today, in everyday words.',
    'Workouts: talk in broad terms (shoulders, biceps, legs, core), never anatomical muscle names. Suggest the routine as a fresh option, and use the bracketed note on what they have been doing to encourage them. Do not assume they want to target anything in particular.',
    'For a food or workout card the body is one complete lead-in sentence under 110 characters. The app adds its own line with the figures after it, so do not repeat figures or the same point.',
    'Write no numbers in a food or workout card, and no Markdown, emojis or calendar dates. Every sentence is grammatical, starts with a capital letter and ends with a full stop.',
    'A "general" card has ref null and is one encouraging insight from their data (a trend or a streak), under 140 characters. It may quote a figure exactly as it appears in the user data above. It must not be about drinking water, steps or logging meals, which the app already reminds them about. Use one only if you have something worth saying.',
    'This task replaces the length and format rules above.',
    'Food candidates:',
    ...(foods.length ? foods.map(line) : ['- none']),
    'Workout candidates:',
    ...(workouts.length ? workouts.map(line) : ['- none']),
  ].join('\n');

  try {
    const result = await chat({ system, messages: [{ role: 'user', content: 'Choose my recommendations for now.' }] });
    const cards = parseAiCards(result.text || '', candidates, context.isMinor);
    return cards && { cards, provider: result.provider };
  } catch (err) {
    console.warn('[recommendations] AI failed, using plain picks:', err.message);
    return null;
  }
}

// ---- Generation ------------------------------------------------------------------

async function generate(userId, timeZone, day) {
  const existing = await Recommendation.listForDay(userId, day);
  // Cards already dismissed or done today don't come back
  const closed = new Set(existing.filter((r) => r.status !== 'new').map((r) => r.ref || r.title));

  const [context, profile, goal, recentMeals] = await Promise.all([
    buildCoachContext(userId),
    User.getProfile(userId),
    User.getActiveGoal(userId),
    Meal.listSince(userId, day),
  ]);

  const logged = recentMeals.filter((m) => m.mealDate === day);
  const items = logged.flatMap((m) => m.items);
  const eaten = Meal.totalsOf(items);
  const loggedNames = new Set(items.map((i) => String(i.foodName).toLowerCase()));

  const workouts = await workoutCandidates(userId, profile);
  const foods = foodCandidates({ profile, goal, eaten, loggedNames, isMinor: context.isMinor });
  const candidates = [...foods, ...workouts];
  const nudge = needsNudge(profile, context.isMinor);
  if (!candidates.length && !nudge) {
    await Recommendation.replaceOpen(userId, day, []);
    return Recommendation.listForDay(userId, day);
  }

  // No model call when there is nothing for it to choose from
  const ai = candidates.length ? await aiCards(context, candidates) : null;
  // Without the model: the best food and the best workout
  let picks = ai?.cards || [foods[0], workouts[0]].filter(Boolean).map((c) => ({ ...c, body: c.reason }));
  // A food or workout the model left out is added, so anyone with candidates
  // sees one of each. General cards go last
  const missing = [foods[0], workouts[0]].filter((c) => c && !picks.some((p) => p.kind === c.kind)).map((c) => ({ ...c, body: c.reason }));
  picks = [...(nudge ? [FOOD_NUDGE] : []), ...picks.filter((p) => p.kind !== 'general'), ...missing, ...picks.filter((p) => p.kind === 'general')];
  const source = ai ? 'ai' : 'rule';
  // Null for the local picks
  const provider = ai ? ai.provider : null;

  const seen = new Set(closed);
  const rows = picks
    .filter((c) => !seen.has(c.ref || c.title) && seen.add(c.ref || c.title))
    .slice(0, MAX_CARDS)
    .map(({ kind, title, body, detail, ref, route, exercises }) => ({ kind, title, body, detail, ref, route, exercises, source, provider }));

  await Recommendation.replaceOpen(userId, day, rows);
  return Recommendation.listForDay(userId, day);
}

// Joins a run already under way for this user rather than starting another
function regenerate(userId, timeZone, day, refreshes) {
  if (inflight.has(userId)) return inflight.get(userId);
  // Cleared before the run, so a change made during it counts for the next
  changed.delete(userId);
  const job = generate(userId, timeZone, day)
    .then((rows) => {
      runs.set(userId, { day, at: Date.now(), refreshes });
      return rows;
    })
    .finally(() => inflight.delete(userId));
  inflight.set(userId, job);
  return job;
}

function toClient(row) {
  // A routine card opens the routine editor, pre-filled (the workouts screen loads it by id)
  const routine = row.kind === 'workout' && row.exercises?.length > 0;
  // The nudge card opens the coach
  const nudge = row.ref === FOOD_NUDGE.ref;
  return {
    id: row.id,
    kind: row.kind,
    title: nudge ? FOOD_NUDGE.title : row.title,
    body: nudge ? FOOD_NUDGE.body : row.body,
    detail: nudge ? null : row.detail,
    source: row.source,
    feedback: row.feedback,
    action: routine
      ? { label: 'Create routine', route: `/workouts?rec=${row.id}` }
      : { label: nudge ? ACTIONS.general.label : ACTIONS[row.kind].label, route: row.route || ACTIONS[row.kind].route },
  };
}

function payload(rows, run) {
  return {
    items: rows.filter((r) => r.status === 'new').map(toClient),
    canRefresh: run.refreshes < MAX_REFRESHES && Date.now() - run.at >= REFRESH_COOLDOWN_MS,
  };
}

// ---- Handlers ----------------------------------------------------------------------

// GET /api/recommendations -- today's cards, generated on first open and again
// once they are STALE_MS old
const listRecommendations = asyncHandler(async (req, res) => {
  const timeZone = await userTimeZone(req);
  const day = today(timeZone);
  let rows = await Recommendation.listForDay(req.userId, day);
  let run = runOf(req.userId, day, rows);

  const age = Date.now() - run.at;
  if (age > STALE_MS || (changed.has(req.userId) && age > CHANGED_MIN_MS)) {
    rows = await regenerate(req.userId, timeZone, day, run.refreshes);
    run = runs.get(req.userId);
  }
  return sendSuccess(res, { data: payload(rows, run) });
});

// POST /api/recommendations/refresh -- new cards on request, paced
const refreshRecommendations = asyncHandler(async (req, res) => {
  const timeZone = await userTimeZone(req);
  const day = today(timeZone);
  const current = await Recommendation.listForDay(req.userId, day);
  const run = runOf(req.userId, day, current);

  if (run.refreshes >= MAX_REFRESHES) {
    throw ApiError.tooManyRequests(`You can refresh ${MAX_REFRESHES} times a day. Come back tomorrow.`);
  }
  if (Date.now() - run.at < REFRESH_COOLDOWN_MS) {
    throw ApiError.tooManyRequests('These were just updated. Try again in a little while.');
  }

  const rows = await regenerate(req.userId, timeZone, day, run.refreshes + 1);
  return sendSuccess(res, { data: payload(rows, runs.get(req.userId)) });
});

// PATCH /api/recommendations/:id -- dismiss, mark done, or rate
const updateRecommendation = asyncHandler(async (req, res) => {
  // 404 rather than 403, same as conversations
  const row = await Recommendation.updateOwned(req.params.id, req.userId, req.body);
  if (!row) throw ApiError.notFound('Recommendation not found');
  return sendSuccess(res, { data: toClient(row) });
});

// GET /api/recommendations/:id/draft -- a routine card as a routine about to be
// created. Nothing is saved: the editor opens on it and the user saves it
const draftRecommendation = asyncHandler(async (req, res) => {
  const row = await Recommendation.findOwned(req.params.id, req.userId);
  if (!row?.exercises?.length) throw ApiError.notFound('Recommendation not found');

  // A workout deleted since it was suggested drops out
  const found = await Workout.find({ _id: { $in: row.exercises.map((e) => e.exerciseRef) }, ...Workout.visibleTo(req.userId) }, '_id').lean();
  const alive = new Set(found.map((w) => w._id));
  const exercises = row.exercises
    .filter((e) => alive.has(e.exerciseRef))
    .map(({ exerciseRef, exerciseName, targetSets, targetReps }) => ({ exerciseRef, exerciseName, targetSets, targetReps }));
  if (!exercises.length) throw ApiError.notFound('Those workouts are no longer available');

  return sendSuccess(res, { data: { title: row.title, description: row.detail || '', exercises } });
});

module.exports = { listRecommendations, refreshRecommendations, updateRecommendation, draftRecommendation, invalidateRecommendations };