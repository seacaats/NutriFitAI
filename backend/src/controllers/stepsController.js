const DailySteps = require('../models/steps/DailySteps');
const User = require('../models/user/User');

const { sendSuccess, asyncHandler, ApiError } = require('../utils/httpResponse');
const { today } = require('../utils/calendarDay');
const { logAction } = require('../utils/audit-logs/auditLogger');
const { notify } = require('../services/notifications/notify');
const { DEFAULT_DAILY_STEP_GOAL } = require('../utils/goals/goalLimits');

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
    User.getActiveGoal(userId),
    User.getProfile(userId),
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
    User.getActiveGoal(req.userId),
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
// Step goal reached today, once per day (dedupe key). Only today counts: a
// backfilled or edited past day isn't news. Never throws
async function checkStepGoal(req) {
  try {
    const timeZone = req.timeZone || (await User.getProfile(req.userId))?.timezone || undefined;
    const day = today(timeZone);
    const [row, goal] = await Promise.all([
      DailySteps.findByDate({ userId: req.userId, activityDate: day }),
      User.getActiveGoal(req.userId),
    ]);
    if (row && Number(row.stepCount) >= (goal?.dailySteps ?? DEFAULT_DAILY_STEP_GOAL)) {
      await notify(req.userId, 'steps_goal_reached', { dedupeKey: `steps-goal:${day}` });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[steps] goal check failed', err);
  }
}

const syncSteps = asyncHandler(async (req, res) => {
  const { source, days } = req.body;

  const changed = await DailySteps.upsertMany({ userId: req.userId, source, days });

  // Records that a sync happened even when nothing changed
  await User.updateProfile(req.userId, {
    stepSource: source,
    lastStepSyncAt: new Date(),
  });

  checkStepGoal(req);

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

  // The user's own "today", not the server's
  const timeZone = req.timeZone || (await User.getProfile(req.userId))?.timezone || undefined;
  const last = today(timeZone);
  // Any past day can be edited, just not a day that hasn't happened yet
  if (activityDate > last) {
    throw ApiError.badRequest("Steps can't be entered for a future day.", { code: 'FUTURE_DAY' });
  }

  // Manual rows are never overwritten by a phone sync (see DailySteps.upsertMany)
  const row = await DailySteps.setManual({ userId: req.userId, activityDate, stepCount });
  if (activityDate === last) checkStepGoal(req);
  return sendSuccess(res, { data: toClientRow(row), message: 'Steps saved' });
});

// PATCH /api/steps/source
//
// Called once, after the user grants the OS health permission
const setStepSource = asyncHandler(async (req, res) => {
  const { source } = req.body;

  const previous = await User.getProfile(req.userId);
  const profile = await User.updateProfile(req.userId, {
    stepSource: source,
    stepPermissionAt: new Date(),
  });

  // Reconnecting the same source isn't a change
  if ((previous?.stepSource ?? null) !== source) {
    await logAction(req, {
      action: 'activity.steps.source_changed',
      targetType: 'user',
      details: { previousSource: previous?.stepSource ?? 'none', source },
    });
  }

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
  const previous = await User.getProfile(req.userId);
  await User.updateProfile(req.userId, {
    stepSource: null,
    stepPermissionAt: null,
  });

  if (previous?.stepSource) {
    await logAction(req, {
      action: 'activity.steps.permission_revoked',
      targetType: 'user',
      details: { previousSource: previous.stepSource },
    });
  }

  return sendSuccess(res, {
    data: { source: null },
    message: 'Step tracking disconnected. Revoke health access in your device settings to stop it completely.',
  });
});

// PUT /api/steps/goal -- saved on the active goal, like the water goal
const setStepGoal = asyncHandler(async (req, res) => {
  const goal = await User.setGoalTarget(req.userId, 'dailySteps', req.body.dailySteps);
  if (!goal) throw ApiError.notFound('User not found');
  return sendSuccess(res, { data: { dailyGoal: goal.dailySteps }, message: 'Step goal saved' });
});

module.exports = {
  getSteps,
  setStepGoal,
  getToday,
  syncSteps,
  setManualSteps,
  setStepSource,
  clearStepSource,
  DEFAULT_DAILY_STEP_GOAL,
};