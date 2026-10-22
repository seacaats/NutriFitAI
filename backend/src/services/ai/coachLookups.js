const Workout = require('../../models/workouts/Workout');
const WorkoutRoutine = require('../../models/workouts/WorkoutRoutine');
const FavoriteWorkout = require('../../models/workouts/FavoriteWorkout');
const Recommendation = require('../../models/recommendations/Recommendation');
const { today } = require('../../utils/calendarDay');
const env = require('../../../config/env');
const { embedQuery } = require('./embeddings');
const vectorIndex = require('./vectorIndex');
const FOODS = require('../../../data/nutrition_data.json');
const GUIDANCE = require('../../../data/coach_guidance.json');

// Topic-gated, capped context lookups for the AI coach.

const MAX_FOODS = 6;
const MAX_EXERCISES = 6;
const MAX_ROUTINES = 3;
const MAX_FAVORITES = 5;
const MAX_CARDS = 4;
const MAX_NOTES = 2;

const WORKOUT_TOPIC = /\b(workouts?|exercises?|routines?|train(ing)?|gym|reps?|sets?|muscles?|stretch(es|ing)?|cardio|strength|lift(ing)?|squats?|push[- ]?ups?|planks?|dumbbells?|barbells?|kettlebells?|bodyweight|chest|back|legs?|arms?|abs|core|glutes?|shoulders?|biceps?|triceps?|quads?|hamstrings?|calves|ehersisyo)\b/i;
const FOOD_TOPIC = /\b(foods?|eat|eating|ate|meals?|breakfast|lunch|dinner|snacks?|calories?|kcal|protein|carbs?|fats?|macros?|nutrition|dish|recipes?|hungry|ulam|kain|pagkain|merienda)\b/i;
const IDEA_TOPIC = /\b(recommend\w*|suggest\w*|ideas?|cards?|what should|what can i|what to (eat|do)|any tips?|plan for today)\b/i;
const NO_EQUIPMENT_TOPIC = /\b(no equipment|bodyweight|at home|home workout)\b/i;
const NO_EQUIPMENT = /^none/i;

const STOP = new Set('eat eating ate food foods meal meals idea ideas recommend suggest snack the and for what how can you give some with that this have want need should would could please something about more any good best tell show make much many like into from they them are was were not but out get does did day today me my its your i am is it of to in on at a an do be so if or'.split(' '));
const ALIAS = {
  abs: 'abdominis', core: 'abdominis|core', arms: 'biceps|triceps|brachi', legs: 'quadriceps|hamstring|gluteus|gastrocnemius|soleus',
  chest: 'pectoralis|chest', back: 'latissimus|trapezius|rhomboid', shoulders: 'deltoid|shoulder', glutes: 'gluteus', quads: 'quadriceps',
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function termsOf(message) {
  const words = String(message || '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3 && !STOP.has(w));
  return [...new Set(words.map((w) => (ALIAS[w] ? w : w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w)))].slice(0, 5);
}
const patternOf = (terms) => new RegExp(terms.map((t) => ALIAS[t] || esc(t)).join('|'), 'i');
const short = (text, n) => (String(text).length > n ? `${String(text).slice(0, n - 1)}…` : String(text));
const names = (list) => (list || []).map((x) => x.name).filter(Boolean);

// Semantic search with keyword fallback
const FOOD_BY_ID = new Map(FOODS.map((f) => [String(f.id), f]));
const NOTE_BY_ID = new Map(GUIDANCE.filter((n) => n.reviewed).map((n) => [String(n.id), n.text]));
const rank = (vec, type, k) => vectorIndex.search(type, vec, { k, min: env.ai.embed.minSimilarity });

// Randomly sample n items while preserving relative rank order
const sample = (list, n) => list.map((item, i) => ({ item, i })).sort(() => Math.random() - 0.5).slice(0, n).sort((a, b) => a.i - b.i).map((x) => x.item);

function semanticFoods(vec) {
  const hits = rank(vec, 'food', MAX_FOODS * 2).map((h) => FOOD_BY_ID.get(h.id)).filter(Boolean);
  return hits.length ? sample(hits, MAX_FOODS) : null;
}
const noteLines = (vec) => rank(vec, 'note', MAX_NOTES).map((h) => NOTE_BY_ID.get(h.id)).filter(Boolean).map((t) => `- ${t}`);

const clean = (name) => String(name).replace(/_/g, ' ');
const foodLine = (f) => `- ${clean(f.display_name || f.name)} (${f.serving}${f.portion_estimated ? ', est.' : ''}): ${f.calories_kcal} kcal, P${f.protein_g} C${f.carbs_g} F${f.fats_g}`;
function foodMatches(terms, message) {
  const re = terms.length ? patternOf(terms) : null;
  const hits = re ? FOODS.filter((f) => re.test(clean(f.name)) || re.test(clean(f.display_name || ''))) : [];
  const score = (f) => terms.filter((t) => clean(`${f.name} ${f.display_name || ''}`).toLowerCase().includes(t)).length;
  if (hits.length) return hits.sort((a, b) => score(b) - score(a)).slice(0, MAX_FOODS);
  const pool = /protein/i.test(message) ? [...FOODS].sort((a, b) => b.protein_g - a.protein_g)
    : /low[- ]?cal|light|lose weight|diet/i.test(message) ? FOODS.filter((f) => f.calories_kcal > 0).sort((a, b) => a.calories_kcal - b.calories_kcal)
      : [];
  return pool.slice(0, 12).sort(() => Math.random() - 0.5).slice(0, MAX_FOODS);
}

function catalogFilter(userId, message) {
  const and = [Workout.visibleTo(userId), { $or: [{ hasRealImage: true }, { source: 'user' }] }];
  if (NO_EQUIPMENT_TOPIC.test(message)) and.push({ $or: [{ equipment: { $size: 0 } }, { 'equipment.name': NO_EQUIPMENT }] });
  return and;
}

function workoutLine(w) {
  const muscle = names(w.muscles).slice(0, 2).join('/');
  const gear = names(w.equipment).filter((n) => !NO_EQUIPMENT.test(n)).slice(0, 1).join('');
  return `- ${w.name}${muscle || gear ? ` (${[muscle, gear].filter(Boolean).join(', ')})` : ''}${w.source === 'user' ? ' [their own]' : ''}`;
}

async function semanticCatalog(userId, vec, message) {
  const hits = rank(vec, 'exercise', MAX_EXERCISES * 2);
  if (!hits.length) return null;
  const rows = await Workout.find({ $and: [{ _id: { $in: hits.map((h) => h.id) } }, ...catalogFilter(userId, message)] })
    .select('name muscles equipment source').lean();
  const byId = new Map(rows.map((w) => [String(w._id), w]));
  const lines = sample(hits.map((h) => byId.get(h.id)).filter(Boolean), MAX_EXERCISES).map(workoutLine);
  return lines.length ? lines : null;
}

async function catalogLines(userId, terms, message, vec) {
  const semantic = vec ? await semanticCatalog(userId, vec, message).catch(() => null) : null;
  if (semantic) return semantic;

  const and = catalogFilter(userId, message);
  const keys = terms.filter((t) => WORKOUT_TOPIC.test(t) || ALIAS[t]);
  if (keys.length) {
    const re = patternOf(keys);
    and.push({ $or: [{ name: re }, { 'muscles.name': re }, { 'category.name': re }, { 'equipment.name': re }] });
  }
  const rows = await Workout.aggregate([
    { $match: { $and: and } },
    { $sample: { size: MAX_EXERCISES } },
    { $project: { name: 1, muscles: 1, equipment: 1, source: 1 } },
  ]);
  return rows.map(workoutLine);
}

// Custom routines first, plus built-ins matching message terms
async function routineLines(userId, terms) {
  const all = await WorkoutRoutine.listVisible(userId);
  const re = terms.length ? patternOf(terms) : null;
  const picked = [...all.filter((r) => !r.builtIn).slice(0, MAX_ROUTINES), ...all.filter((r) => r.builtIn && re && re.test(r.title)).slice(0, 2)].slice(0, MAX_ROUTINES + 1);
  return picked.map((r) => {
    const ex = (r.exercises || []).map((e) => e.exerciseName);
    return `- ${short(r.title, 50)}${r.builtIn ? ' [built-in]' : ''}: ${ex.slice(0, 4).join(', ')}${ex.length > 4 ? ` +${ex.length - 4} more` : ''}`;
  });
}

async function cardLines(userId, timeZone) {
  const rows = await Recommendation.listForDay(userId, today(timeZone));
  return rows.filter((r) => r.status === 'new').slice(0, MAX_CARDS).map((r) => `- ${r.kind}: ${short(r.title, 50)}. ${short(r.body, 90)}`);
}

/**
 * @param {{ userId: string, message?: string, timeZone?: string, isMinor?: boolean, healthNotes?: boolean, concerns?: string[] }} input
 * @returns {Promise<string[]>}
 */
async function coachLookups({ userId, message, timeZone, isMinor, healthNotes, concerns = [] }) {
  const text = String(message || '').slice(0, 300);
  if (!text || concerns.includes('selfHarm') || concerns.includes('eatingDisorder')) return [];

  const terms = termsOf(text);
  const wantWorkout = WORKOUT_TOPIC.test(text);
  // Skip food figures and embeddings for minors or users with health notes
  const wantFoods = !(isMinor || healthNotes) && (FOOD_TOPIC.test(text) || terms.some((t) => t.length >= 4 && FOODS.some((f) => clean(f.name).includes(t))));
  const vec = !(isMinor || healthNotes) && (wantFoods || wantWorkout) ? await embedQuery(text) : null;
  const foods = wantFoods ? semanticFoods(vec) || foodMatches(terms, text) : [];
  const wantCards = IDEA_TOPIC.test(text) || (wantWorkout && /\b(today|plan)\b/i.test(text));
  if (!wantWorkout && !foods.length && !wantCards) return [];

  const [cards, routines, favorites, catalog] = await Promise.all([
    wantCards ? cardLines(userId, timeZone) : [],
    wantWorkout ? routineLines(userId, terms) : [],
    wantWorkout ? FavoriteWorkout.list(userId) : [],
    wantWorkout ? catalogLines(userId, terms, text, vec) : [],
  ]);

  const out = [];
  const add = (title, lines) => { if (lines.length) out.push('', title, ...lines); };
  add('TODAY\'S RECOMMENDATION CARDS (already shown to the user on their dashboard):', cards);
  add('THEIR WORKOUT ROUTINES:', routines);
  add('THEIR FAVORITES:', favorites.length ? [`- ${favorites.slice(0, MAX_FAVORITES).map((f) => short(f.name, 40)).join(', ')}`] : []);
  add('WORKOUT CATALOG MATCHES (a sample, not the full list):', catalog);
  add('FOODS FROM THE APP\'S NUTRITION TABLE (one serving each):', foods.map(foodLine));
  add('GENERAL COACHING NOTES (use only if they fit the question):', vec ? noteLines(vec) : []);
  if (out.length) out.push('Name specific workouts or foods only from these lists. If nothing here fits, say so and give general guidance. Never claim these are the full list.');
  return out;
}

module.exports = { coachLookups };
