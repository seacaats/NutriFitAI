const DailySteps = require('../models/steps/DailySteps');
const User = require('../models/user/User');

const { sendSuccess, asyncHandler, ApiError } = require('../utils/httpResponse');
const { today } = require('../utils/calendarDay');
const { logAction } = require('../utils/audit-logs/auditLogger');
const { notify } = require('../services/notifications/notify');
const { userTimeZone } = require('../services/user/userTimeZone');
const { DEFAULT_DAILY_STEP_GOAL } = require('../utils/goals/goalLimits');

function toClientRow(row) {
  return {
    activityDate: row.activityDate,
    stepCount: Number(row.stepCount),
    distanceMeters: row.distanceMeters === null ? null : Number(row.distanceMeters),
    source: row.source,
    syncedAt: row.syncedAt ?? null,
  };
}

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
const getToday = asyncHandler(async (req, res) => {
  const date = req.validatedQuery?.date || today(await userTimeZone(req));

  const [row, goal] = await Promise.all([
    DailySteps.findByDate({ userId: req.userId, activityDate: date }),
    User.getActiveGoal(req.userId),
  ]);

  return sendSuccess(res, {
    data: {
      activityDate: date,
      steps: row ? toClientRow(row) : null,
      dailyGoal: goal?.dailySteps ?? DEFAULT_DAILY_STEP_GOAL,
    },
  });
});

// Send a daily notification when today's step goal is reached
async function checkStepGoal(req) {
  try {
    const day = today(await userTimeZone(req));
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

// POST /api/steps/sync
const syncSteps = asyncHandler(async (req, res) => {
  const { source, days } = req.body;

  const changed = await DailySteps.upsertMany({ userId: req.userId, source, days });

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
const setManualSteps = asyncHandler(async (req, res) => {
  const { activityDate, stepCount } = req.body;

  const timeZone = await userTimeZone(req);
  const last = today(timeZone);
  if (activityDate > last) {
    throw ApiError.badRequest("Steps can't be entered for a future day.", { code: 'FUTURE_DAY' });
  }

  const row = await DailySteps.setManual({ userId: req.userId, activityDate, stepCount });
  if (activityDate === last) checkStepGoal(req);
  return sendSuccess(res, { data: toClientRow(row), message: 'Steps saved' });
});

// PATCH /api/steps/source
const setStepSource = asyncHandler(async (req, res) => {
  const { source } = req.body;

  const previous = await User.getProfile(req.userId);
  const profile = await User.updateProfile(req.userId, {
    stepSource: source,
    stepPermissionAt: new Date(),
  });

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

// PUT /api/steps/goal
const setStepGoal = asyncHandler(async (req, res) => {
  const goal = await User.setGoalTarget(req.userId, 'dailySteps', req.body.dailySteps);
  if (!goal) throw ApiError.notFound('We couldn\'t find your account. Please sign in again.');
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
