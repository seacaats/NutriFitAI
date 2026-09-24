const DailySteps = require('../models/health/DailySteps');
const UserGoal = require('../models/user/UserGoal');
const UserProfile = require('../models/user/UserProfile');

const { sendSuccess, asyncHandler } = require('../utils/httpResponse');

// Daily step goal fallback
const DEFAULT_DAILY_STEP_GOAL = 10000;

// Converts step/distance values from the database's string format into real numbers
function toClientRow(row) {
  return {
    activityDate: row.activityDate,
    stepCount: Number(row.stepCount),
    distanceMeters: row.distanceMeters === null ? null : Number(row.distanceMeters),
    source: row.source,
    syncedAt: row.syncedAt ?? null,
  };
}

// Only return days that actually have data, which the client handles
// as having gaps or presenting actual zeroes 
async function buildStepsPayload(userId, from, to) {
  const [rows, goal, profile] = await Promise.all([
    DailySteps.findRange({ userId, from, to }),
    UserGoal.findActiveByUserId(userId),
    UserProfile.findByUserId(userId),
  ]);

  return {
    from,
    to,
    days: rows.map(toClientRow),
    dailyGoal: goal?.dailySteps ?? DEFAULT_DAILY_STEP_GOAL,
    // Drives the web empty state: "no phone connected yet" reads
    // differently from "connected, nothing recorded this week"
    tracking: {
      source: profile?.stepSource ?? null,
      connectedAt: profile?.stepPermissionAt ?? null,
      lastSyncAt: profile?.lastStepSyncAt ?? null,
    },
  };
}

// GET /api/steps?from=YYYY-MM-DD&to=YYYY-MM-DD
const getSteps = asyncHandler(async (req, res) => {
  const { from, to } = req.validatedQuery;
  const data = await buildStepsPayload(req.userId, from, to);
  return sendSuccess(res, { data });
});

// GET /api/steps/today?date=YYYY-MM-DD
//
// `date` is supplied by the client but falls back 
// to the server's UTC date only when the they omit it
const getToday = asyncHandler(async (req, res) => {
  const date = req.validatedQuery?.date || new Date().toISOString().slice(0, 10);

  const [row, goal] = await Promise.all([
    DailySteps.findByDate({ userId: req.userId, activityDate: date }),
    UserGoal.findActiveByUserId(req.userId),
  ]);

  return sendSuccess(res, {
    data: {
      activityDate: date,
      // null rather than 0: "not recorded" is not the same as "zero steps"
      steps: row ? toClientRow(row) : null,
      dailyGoal: goal?.dailySteps ?? DEFAULT_DAILY_STEP_GOAL,
    },
  });
});

// POST /api/steps/sync
//
// The phone pushes whatever window it read from the OS health store. Called on
// every app foreground, -- DailySteps.upsertMany skips rows whose numbers haven't moved
const syncSteps = asyncHandler(async (req, res) => {
  const { source, days } = req.body;

  const changed = await DailySteps.upsertMany({ userId: req.userId, source, days });

  // Records that a sync happened even when nothing changed
  await UserProfile.upsert(req.userId, {
    stepSource: source,
    lastStepSyncAt: new Date(),
  });

  return sendSuccess(res, {
    data: {
      received: days.length,
      updated: changed.length,
      days: changed.map(toClientRow),
    },
  });
});

// POST /api/steps/manual
//
// Always wins over sensor data, and pins the row with source='manual'
// All in case, a phone with the sensor/application was left at home
const setManualSteps = asyncHandler(async (req, res) => {
  const { activityDate, stepCount } = req.body;
  const row = await DailySteps.setManual({ userId: req.userId, activityDate, stepCount });
  return sendSuccess(res, { data: toClientRow(row), message: 'Steps saved' });
});

// PATCH /api/steps/source
//
// Called once, after the user grants the OS health permission
const setStepSource = asyncHandler(async (req, res) => {
  const { source } = req.body;

  const profile = await UserProfile.upsert(req.userId, {
    stepSource: source,
    stepPermissionAt: new Date(),
  });

  return sendSuccess(res, {
    data: {
      source: profile.stepSource,
      connectedAt: profile.stepPermissionAt,
    },
    message: 'Step tracking connected',
  });
});

// DELETE /api/steps/source
const clearStepSource = asyncHandler(async (req, res) => {
  await UserProfile.upsert(req.userId, {
    stepSource: null,
    stepPermissionAt: null,
  });

  return sendSuccess(res, {
    data: { source: null },
    message: 'Step tracking disconnected. Revoke health access in your device settings to stop it completely.',
  });
});

module.exports = {
  getSteps,
  getToday,
  syncSteps,
  setManualSteps,
  setStepSource,
  clearStepSource,
  DEFAULT_DAILY_STEP_GOAL,
};