const env = require('../../config/env');
const FoodScan = require('../models/food/FoodScan');
const Meal = require('../models/food/Meal');
const User = require('../models/user/User');
const storage = require('../utils/storage');
const { looksLikeImage } = require('../utils/storage/keys');
const { logAction } = require('../utils/audit-logs/auditLogger');
const { today } = require('../utils/calendarDay');
const { asyncHandler, sendSuccess, ApiError } = require('../utils/httpResponse');

// Daily calorie and macro targets on the active goal; null when not set
const NUTRITION_TARGETS = ['dailyCaloriesKcal', 'dailyProteinG', 'dailyCarbsG', 'dailyFatG'];

const nutritionGoalsOf = (goal) => Object.fromEntries(NUTRITION_TARGETS.map((k) => [k, goal?.[k] ?? null]));

// ---- Detection server --------------------------------------------------------

/**
 * Sends one image to the FastAPI model server and returns its raw items.
 * Throws with a `stage` so the audit entry says where it broke: 'unreachable'
 * (down, timed out) or 'rejected' (non-2xx, e.g. a wrong AI_DETECT_API_KEY)
 */
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

// Model output -> food_scans item. Values are per ONE serving
function toScanItem(raw) {
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    foodName: String(raw.foodName || 'unknown').slice(0, 150),
    serving: raw.serving ? String(raw.serving).slice(0, 60) : null,
    estimatedGrams: num(raw.servingGrams),
    caloriesKcal: num(raw.caloriesKcal),
    proteinG: num(raw.proteinG),
    carbsG: num(raw.carbsG),
    fatG: num(raw.fatG),
    confidence: num(raw.confidence),
  };
}

// ---- Payloads ----------------------------------------------------------------

// What the scanner screen renders. `missing` lists foods the model found but
// the nutrition table doesn't cover, the user types those values in
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
    // Relative path, the app resolves it against the API origin (mediaUrl.js)
    imageUrl: scan.storageKey ? await storage.urlFor(scan.storageKey) : null,
    items,
    missing: [...new Set(items.filter((i) => !i.hasNutrition).map((i) => i.foodName))],
  };
}

async function userTimeZone(req) {
  if (req.timeZone) return req.timeZone;
  return (await User.getProfile(req.userId))?.timezone || undefined;
}

// ---- Scans -------------------------------------------------------------------

// POST /api/food/scans   (multipart/form-data, field name: "image")
const createScan = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file || !file.buffer) {
    throw ApiError.badRequest('No image was uploaded', { code: 'NO_FILE' });
  }

  // Declared type must be one we store, AND the bytes must actually be it
  const mimetype = (file.mimetype || '').split(';')[0].trim().toLowerCase();
  const ext = storage.keys.EXT_BY_TYPE[mimetype];
  if (!ext || !looksLikeImage(file.buffer, ext)) {
    throw ApiError.badRequest('Upload a JPEG, PNG or WebP photo.', { code: 'INVALID_IMAGE' });
  }

  const { key } = await storage.save(file.buffer, {
    key: storage.keys.scanKey(req.userId, mimetype),
    contentType: mimetype,
  });
  const pending = await FoodScan.createProcessing(req.userId, key);

  let rawItems;
  try {
    rawItems = await detectFood(file.buffer, mimetype);
  } catch (err) {
    // The scan and its photo are kept as 'failed' (the purge still clears the
    // photo later), so the failure rate shows up in the audit trail
    await FoodScan.fail(pending.id);
    await logAction(req, {
      action: 'nutrition.scan.failed',
      targetType: 'food_scan',
      targetId: pending.id,
      details: { reason: err.message, stage: err.stage || 'unknown' },
    });
    throw new ApiError(502, "We couldn't analyze that photo right now. Please try again.", { code: 'SCAN_FAILED' });
  }

  const scan = await FoodScan.complete(pending.id, rawItems.map(toScanItem));
  return sendSuccess(res, { statusCode: 201, data: await toScanPayload(scan) });
});

// GET /api/food/scans?limit=10&before=<ISO> -- completed scans, newest first.
// nextBefore is null once there's nothing older
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

// GET /api/food/scans/:id -- reopens a past scan to log it
const getScan = asyncHandler(async (req, res) => {
  const scan = await FoodScan.getOwned(req.params.id, req.userId);
  if (!scan) throw ApiError.notFound('Scan not found');
  return sendSuccess(res, { data: await toScanPayload(scan) });
});

// DELETE /api/food/scans/:id -- the scan and its photo
const removeScan = asyncHandler(async (req, res) => {
  const scan = await FoodScan.removeOwned(req.params.id, req.userId);
  if (!scan) throw ApiError.notFound('Scan not found');

  // Never throws (see localStore.remove), a missing file is already gone
  if (scan.storageKey) await storage.remove(scan.storageKey);
  return sendSuccess(res, { message: 'Scan deleted', data: { id: scan.id } });
});

// ---- Meals -------------------------------------------------------------------

const round1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);

// POST /api/food/meals -- logs the selected foods of a scan as eaten today
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

    // The scan's values win. Typed values only fill foods the table lacks
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

  // The user's own today, never the server's, see calendarDay.js
  const mealDate = today(await userTimeZone(req));
  const meal = await Meal.logConsumed({ userId: req.userId, mealType, mealDate, items: mealItems });

  return sendSuccess(res, { statusCode: 201, message: 'Meal logged', data: meal });
});

// GET /api/food/meals/history?before=YYYY-MM-DD&days=14 -- days with meals,
// newest first. nextBefore is null once there's nothing older. The scanner's
// "Recent Meals" card asks for the first few days of the same list
const getMealHistory = asyncHandler(async (req, res) => {
  const days = req.validatedQuery?.days || 14;
  const [page, goal] = await Promise.all([
    Meal.historyPage(req.userId, { before: req.validatedQuery?.before, days }),
    User.getActiveGoal(req.userId),
  ]);
  return sendSuccess(res, {
    data: {
      days: page,
      // The day's targets, for the totals under each day
      goals: nutritionGoalsOf(goal),
      nextBefore: page.length === days ? page[page.length - 1].date : null,
    },
  });
});

// DELETE /api/food/meals/:id
const removeMeal = asyncHandler(async (req, res) => {
  const meal = await Meal.removeOwned(req.params.id, req.userId);
  if (!meal) throw ApiError.notFound('Meal not found');
  return sendSuccess(res, { message: 'Meal removed', data: { id: meal.id } });
});

// ---- Nutrition goals ---------------------------------------------------------

// GET /api/food/goals
const getNutritionGoals = asyncHandler(async (req, res) => {
  const goal = await User.getActiveGoal(req.userId);
  return sendSuccess(res, { data: nutritionGoalsOf(goal) });
});

// PATCH /api/food/goals -- any of the four; null clears one. Set in place on
// the active goal, like the water and step targets
const setNutritionGoals = asyncHandler(async (req, res) => {
  let goal = null;
  for (const key of NUTRITION_TARGETS) {
    if (req.body[key] === undefined) continue;
    goal = await User.setGoalTarget(req.userId, key, req.body[key]);
    if (!goal) throw ApiError.notFound('User not found');
  }
  return sendSuccess(res, { message: 'Nutrition goals saved', data: nutritionGoalsOf(goal) });
});

module.exports = {
  createScan, listScans, getScan, removeScan, logMeal, getMealHistory, removeMeal,
  getNutritionGoals, setNutritionGoals,
};