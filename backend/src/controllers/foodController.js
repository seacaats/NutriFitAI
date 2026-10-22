const env = require('../../config/env');
const FoodScan = require('../models/food/FoodScan');
const Meal = require('../models/food/Meal');
const User = require('../models/user/User');
const storage = require('../utils/storage');
const { looksLikeImage } = require('../utils/storage/keys');
const { moderateImage, throwIfRejected } = require('../services/moderation/imageModeration');
const { logModeration } = require('../services/moderation/moderationLog');
const { logAction } = require('../utils/audit-logs/auditLogger');
const { today } = require('../utils/calendarDay');
const { asyncHandler, sendSuccess, ApiError } = require('../utils/httpResponse');
const { userTimeZone } = require('../services/user/userTimeZone');
const { invalidateRecommendations } = require('./recommendationController');
const { round1 } = require('../utils/numbers');

const NUTRITION_TARGETS = ['dailyCaloriesKcal', 'dailyProteinG', 'dailyCarbsG', 'dailyFatG'];

const nutritionGoalsOf = (goal) => Object.fromEntries(NUTRITION_TARGETS.map((k) => [k, goal?.[k] ?? null]));

// ---- Detection server --------------------------------------------------------

// Send image to the FastAPI detection server; throws with `stage` ('unreachable' | 'rejected')
async function detectFood(buffer, mimetype) {
  const form = new FormData();
  form.append('image', new Blob([buffer], { type: mimetype }), `scan.${storage.keys.extensionFor(mimetype)}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.ai.detect.timeoutMs);

  let response;
  try {
    response = await fetch(`${env.ai.detect.url}/detect`, {
      method: 'POST',
      headers: env.ai.detect.apiKey ? { 'x-api-key': env.ai.detect.apiKey } : {},
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    throw Object.assign(new Error(err.name === 'AbortError' ? 'timed out' : err.message), { stage: 'unreachable' });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw Object.assign(new Error(`model server replied ${response.status}`), { stage: 'rejected' });
  }
  const body = await response.json();
  return Array.isArray(body.items) ? body.items : [];
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const NUTRIENTS = ['caloriesKcal', 'proteinG', 'carbsG', 'fatG'];

// Nutrition per 100g (from model server or derived from serving values)
function per100gOf(raw, serving, grams) {
  const sent = raw.per100g && typeof raw.per100g === 'object' ? raw.per100g : {};
  const out = {};
  for (const key of NUTRIENTS) {
    out[key] = num(sent[key]) ?? (grams > 0 && serving[key] !== null ? round1((serving[key] / grams) * 100) : null);
  }
  return out.caloriesKcal === null ? null : out;
}

function toScanItem(raw) {
  const grams = num(raw.servingGrams);
  const serving = Object.fromEntries(NUTRIENTS.map((key) => [key, num(raw[key])]));
  return {
    foodName: String(raw.foodName || 'unknown').slice(0, 150),
    serving: raw.serving ? String(raw.serving).slice(0, 60) : null,
    estimatedGrams: grams,
    per100g: per100gOf(raw, serving, grams),
    ...serving,
    confidence: num(raw.confidence),
  };
}

// ---- Payloads ----------------------------------------------------------------

async function toScanPayload(scan) {
  const items = (scan.items || []).map((item) => ({
    ...item,
    itemId: String(item.itemId),
    hasNutrition: item.caloriesKcal !== null,
  }));
  return {
    id: scan.id,
    status: scan.status,
    scannedAt: scan.scannedAt,
    imageUrl: scan.storageKey ? await storage.urlFor(scan.storageKey) : null,
    items,
    missing: [...new Set(items.filter((i) => !i.hasNutrition).map((i) => i.foodName))],
  };
}

// ---- Scans -------------------------------------------------------------------

// POST /api/food/scans
const createScan = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file || !file.buffer) {
    throw ApiError.badRequest('No image was uploaded', { code: 'NO_FILE' });
  }

  const mimetype = (file.mimetype || '').split(';')[0].trim().toLowerCase();
  const ext = storage.keys.EXT_BY_TYPE[mimetype];
  if (!ext || !looksLikeImage(file.buffer, ext)) {
    throw ApiError.badRequest('Upload a JPEG, PNG or WebP photo.', { code: 'INVALID_IMAGE' });
  }

  // Run moderation in parallel with storage and food detection
  const moderation = moderateImage(file.buffer, mimetype);

  const { key } = await storage.save(file.buffer, {
    key: storage.keys.scanKey(req.userId, mimetype),
    contentType: mimetype,
  });
  const pending = await FoodScan.createProcessing(req.userId, key);

  let rawItems;
  try {
    rawItems = await detectFood(file.buffer, mimetype);
  } catch (err) {
    await FoodScan.fail(pending.id);
    await logAction(req, {
      action: 'nutrition.scan.failed',
      targetType: 'food_scan',
      targetId: pending.id,
      details: { reason: err.message, stage: err.stage || 'unknown' },
    });
    throw new ApiError(502, "We couldn't analyze that photo right now. Please try again.", { code: 'SCAN_FAILED' });
  }

  const checked = await moderation;
  if (checked.verdict === 'block') {
    await FoodScan.fail(pending.id);
    await storage.remove(key);
    await logModeration({ userId: req.userId, kind: 'scan', refId: pending.id }, checked);
    throwIfRejected(checked);
  }
  await logModeration({ userId: req.userId, kind: 'scan', storageKey: key, refId: pending.id }, checked);

  const { minConfidence } = env.ai.detect;
  const items = rawItems.map(toScanItem).filter((item) => item.confidence === null || item.confidence >= minConfidence);
  const scan = await FoodScan.complete(pending.id, items);
  return sendSuccess(res, { statusCode: 201, data: await toScanPayload(scan) });
});

// GET /api/food/scans?limit=10&before=<ISO>
const listScans = asyncHandler(async (req, res) => {
  const limit = req.validatedQuery?.limit || 10;
  const before = req.validatedQuery?.before ? new Date(req.validatedQuery.before) : null;
  const scans = await FoodScan.listPage(req.userId, { before, limit });
  return sendSuccess(res, {
    data: {
      scans: await Promise.all(scans.map(toScanPayload)),
      nextBefore: scans.length === limit ? scans[scans.length - 1].scannedAt : null,
    },
  });
});

// GET /api/food/scans/:id
const getScan = asyncHandler(async (req, res) => {
  const scan = await FoodScan.getOwned(req.params.id, req.userId);
  if (!scan) throw ApiError.notFound('Scan not found');
  return sendSuccess(res, { data: await toScanPayload(scan) });
});

// DELETE /api/food/scans/:id
const removeScan = asyncHandler(async (req, res) => {
  const scan = await FoodScan.removeOwned(req.params.id, req.userId);
  if (!scan) throw ApiError.notFound('Scan not found');

  if (scan.storageKey) await storage.remove(scan.storageKey);
  return sendSuccess(res, { message: 'Scan deleted', data: { id: scan.id } });
});

// ---- Meals -------------------------------------------------------------------

// POST /api/food/meals
const logMeal = asyncHandler(async (req, res) => {
  const { scanId, mealType, items } = req.body;

  const scan = await FoodScan.getOwned(scanId, req.userId);
  if (!scan) throw ApiError.notFound('Scan not found');
  if (scan.status !== 'completed') {
    throw ApiError.badRequest("That scan didn't finish, so it can't be logged.", { code: 'SCAN_NOT_COMPLETED' });
  }

  const byId = new Map(scan.items.map((i) => [String(i.itemId), i]));
  const seen = new Set();

  const mealItems = items.map((input) => {
    const source = byId.get(input.scanItemId);
    if (!source) throw ApiError.badRequest('One of those foods is not part of this scan.', { code: 'UNKNOWN_ITEM' });
    if (seen.has(input.scanItemId)) {
      throw ApiError.badRequest('The same food was sent twice.', { code: 'DUPLICATE_ITEM' });
    }
    seen.add(input.scanItemId);

    // Prefer scan nutrition values, falling back to user-provided values when missing from the catalog
    const per = (key) => source[key] ?? input[key] ?? null;
    if (per('caloriesKcal') === null) {
      throw ApiError.badRequest(`Enter the calories for ${source.foodName}.`, { code: 'MISSING_NUTRITION' });
    }

    const n = input.servings;
    const times = (key) => (per(key) === null ? null : round1(per(key) * n));
    return {
      scanRef: { scanId: scan.id, itemId: source.itemId },
      foodName: source.foodName,
      serving: source.serving,
      servings: n,
      portionGrams: source.estimatedGrams === null ? null : round1(source.estimatedGrams * n),
      caloriesKcal: times('caloriesKcal'),
      proteinG: times('proteinG'),
      carbsG: times('carbsG'),
      fatG: times('fatG'),
    };
  });

  const mealDate = today(await userTimeZone(req));
  const meal = await Meal.logConsumed({ userId: req.userId, mealType, mealDate, items: mealItems });

  invalidateRecommendations(req.userId);
  return sendSuccess(res, { statusCode: 201, message: 'Meal logged', data: meal });
});

// GET /api/food/meals/history?before=YYYY-MM-DD&days=14
const getMealHistory = asyncHandler(async (req, res) => {
  const days = req.validatedQuery?.days || 14;
  const [page, goal] = await Promise.all([
    Meal.historyPage(req.userId, { before: req.validatedQuery?.before, days }),
    User.getActiveGoal(req.userId),
  ]);
  return sendSuccess(res, {
    data: {
      days: page,
      goals: nutritionGoalsOf(goal),
      nextBefore: page.length === days ? page[page.length - 1].date : null,
    },
  });
});

// DELETE /api/food/meals/:id
const removeMeal = asyncHandler(async (req, res) => {
  const meal = await Meal.removeOwned(req.params.id, req.userId);
  if (!meal) throw ApiError.notFound('Meal not found');
  invalidateRecommendations(req.userId);
  return sendSuccess(res, { message: 'Meal removed', data: { id: meal.id } });
});

// ---- Nutrition goals ---------------------------------------------------------

// GET /api/food/goals
const getNutritionGoals = asyncHandler(async (req, res) => {
  const goal = await User.getActiveGoal(req.userId);
  return sendSuccess(res, { data: nutritionGoalsOf(goal) });
});

// PATCH /api/food/goals
const setNutritionGoals = asyncHandler(async (req, res) => {
  let goal = null;
  for (const key of NUTRITION_TARGETS) {
    if (req.body[key] === undefined) continue;
    goal = await User.setGoalTarget(req.userId, key, req.body[key]);
    if (!goal) throw ApiError.notFound('We couldn\'t find your account. Please sign in again.');
  }
  invalidateRecommendations(req.userId);
  return sendSuccess(res, { message: 'Nutrition goals saved', data: nutritionGoalsOf(goal) });
});

module.exports = {
  createScan, listScans, getScan, removeScan, logMeal, getMealHistory, removeMeal,
  getNutritionGoals, setNutritionGoals,
};
