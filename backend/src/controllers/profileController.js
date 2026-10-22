const { withTransaction } = require('../../config/mongo');
const User = require('../models/user/User');
const WeightLog = require('../models/user/WeightLog');
const Workout = require('../models/workouts/Workout');
const WorkoutCategory = require('../models/workouts/WorkoutCategory');
const AuthIdentity = require('../models/auth/AuthIdentity');
const { hashPassword, verifyPassword } = require('../utils/auth/password');
const { logAction, diffFields } = require('../utils/audit-logs/auditLogger');
const { notify } = require('../services/notifications/notify');

const { normalizeGoal } = require('../utils/goals/goalNormalizer');
const { sendSuccess, ApiError, asyncHandler } = require('../utils/httpResponse');
const { saveUploadedAvatar, clearStoredAvatar, toPublicAvatarUrl } = require('../utils/storage/avatarStore');
const { deleteAccount: deleteAccountData } = require('../services/user/accountDeletion');
const { clearRefreshCookie } = require('../utils/auth/refreshCookie');
const { invalidateRecommendations } = require('./recommendationController');
const { assertNotMfaLocked, checkAuthenticatorCode, rejectAuthenticatorCode, noteRecoveryUsed } = require('../services/auth/mfa');

async function buildProfilePayload(userId) {
  const user = await User.getById(userId);
  if (!user) throw ApiError.notFound('We couldn\'t find your account. Please sign in again.');

  const profile = await User.getProfile(userId);
  const goal = await User.getActiveGoal(userId);
  const latestWeight = await WeightLog.findLatestByUserId(userId);
  const identities = await AuthIdentity.findByUserId(userId);
  const recoveryCodesLeft = user.mfa?.enabled && (user.role || 'user') !== 'user' ? await User.countRecoveryCodes(userId) : 0;

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    emailVerified: Boolean(user.emailVerifiedAt),
    role: user.role || 'user',
    createdAt: user.createdAt,
    mfaEnabled: Boolean(user.mfa && user.mfa.enabled),
    recoveryCodesLeft,
    linkedProviders: identities.map((i) => i.provider),

    age: profile?.age ?? null,
    sex: profile?.sex ?? null,
    heightCm: profile?.heightCm ?? null,
    activityLevel: profile?.activityLevel ?? null,
    dietPreference: profile?.dietPreference ?? null,
    healthConditions: profile?.healthConditions ?? null,
    notificationsEnabled: profile?.notificationsEnabled ?? true,
    notificationPrefs: {
      reminders: profile?.notificationPrefs?.reminders ?? true,
      achievements: profile?.notificationPrefs?.achievements ?? true,
      quietStart: profile?.notificationPrefs?.quietStart ?? null,
      quietEnd: profile?.notificationPrefs?.quietEnd ?? null,
    },
    timezone: profile?.timezone ?? null,
    avatarUrl: await toPublicAvatarUrl(profile?.avatarStorageKey),

    workoutPrefs: workoutPrefsOf(profile),
    targetWeightKg: profile?.targetWeightKg ?? null,
    weeklyPaceKg: profile?.weeklyPaceKg ?? null,
    coachTone: profile?.coachTone ?? null,
    onboarded: Boolean(profile?.onboardedAt),

    weightKg: latestWeight?.weightKg ?? null,
    weightMeasuredAt: latestWeight?.measuredAt ?? null,
    fitnessGoal: goal?.fitnessGoal ?? null,
    goals: {
      dailyCaloriesKcal: goal?.dailyCaloriesKcal ?? null,
      dailyProteinG: goal?.dailyProteinG ?? null,
      dailyCarbsG: goal?.dailyCarbsG ?? null,
      dailyFatG: goal?.dailyFatG ?? null,
      dailySteps: goal?.dailySteps ?? null,
      dailyWaterMl: goal?.dailyWaterMl ?? null,
    },
  };
}

function workoutPrefsOf(profile) {
  return {
    categoryIds: profile?.workoutPrefs?.categoryIds ?? [],
    equipment: profile?.workoutPrefs?.equipment ?? null,
    equipmentIds: profile?.workoutPrefs?.equipmentIds ?? [],
    muscleIds: profile?.workoutPrefs?.muscleIds ?? [],
    secondaryMuscleIds: profile?.workoutPrefs?.secondaryMuscleIds ?? [],
  };
}

// GET /api/profile
const getProfile = asyncHandler(async (req, res) => {
  const data = await buildProfilePayload(req.userId);
  return sendSuccess(res, { data });
});

const PROFILE_AUDIT_FIELDS = [
  'firstName',
  'lastName',
  'age',
  'sex',
  'heightCm',
  'weightKg',
  'activityLevel',
  'dietPreference',
  'healthConditions',
  'timezone',
  'targetWeightKg',
  'weeklyPaceKg',
  'coachTone',
];

const PROFILE_KEYS = [
  'age',
  'sex',
  'heightCm',
  'activityLevel',
  'dietPreference',
  'healthConditions',
  'timezone',
  'notificationsEnabled',
  'notificationPrefs',
  'workoutPrefs',
  'targetWeightKg',
  'weeklyPaceKg',
  'coachTone',
];

const WORKOUT_PREF_KEYS = ['categoryIds', 'equipment', 'equipmentIds', 'muscleIds', 'secondaryMuscleIds'];

// Resolve workout preference IDs to human-readable names for audit logs
async function workoutPrefNames(key, ids) {
  const names = new Map();
  if (!ids.length) return names;
  try {
    let rows = [];
    if (key === 'categoryIds') {
      rows = (await WorkoutCategory.find({ _id: { $in: ids } }).lean()).map((c) => ({ _id: c._id, name: c.name }));
    } else if (key === 'equipmentIds') {
      rows = await Workout.aggregate([
        { $unwind: '$equipment' },
        { $match: { 'equipment.id': { $in: ids } } },
        { $group: { _id: '$equipment.id', name: { $first: '$equipment.name' } } },
      ]);
    } else if (key === 'muscleIds' || key === 'secondaryMuscleIds') {
      rows = await Workout.aggregate([
        { $project: { m: { $concatArrays: ['$muscles', '$musclesSecondary'] } } },
        { $unwind: '$m' },
        { $match: { 'm.id': { $in: ids } } },
        { $group: { _id: '$m.id', name: { $first: { $ifNull: ['$m.nameEn', '$m.name'] } } } },
      ]);
    }
    rows.forEach((r) => names.set(r._id, r.name));
  } catch (err) {
    console.error('[profile] workout pref names lookup failed', err.message);
  }
  return names;
}

const prefText0 = (value) => (Array.isArray(value) ? (value.length ? value.join(', ') : null) : value ?? null);

async function prefText(key, value, ids) {
  if (!Array.isArray(value)) return value ?? null;
  if (!value.length) return null;
  const names = await workoutPrefNames(key, ids);
  return value.map((id) => names.get(id) ?? id).join(', ');
}

async function profileChanges(before, after) {
  const changes = diffFields(PROFILE_AUDIT_FIELDS, before, after);
  const was = before.workoutPrefs || {};
  const now = after.workoutPrefs || {};
  for (const key of WORKOUT_PREF_KEYS) {
    if (String(prefText0(was[key])) === String(prefText0(now[key]))) continue;
    const ids = [...new Set([...(was[key] || []), ...(now[key] || [])])].filter(Number.isFinite);
    changes.push({ field: `workoutPrefs.${key}`, from: await prefText(key, was[key], ids), to: await prefText(key, now[key], ids) });
  }
  return changes;
}

// Summarize notification preference changes for audit logging
function notificationSettingChanges(before, after) {
  const parts = [];
  const onOff = (v) => (v ? 'on' : 'off');
  if (before.notificationsEnabled !== after.notificationsEnabled) parts.push(`Notifications ${onOff(after.notificationsEnabled)}`);
  const b = before.notificationPrefs;
  const a = after.notificationPrefs;
  if (b.reminders !== a.reminders) parts.push(`Reminders ${onOff(a.reminders)}`);
  if (b.achievements !== a.achievements) parts.push(`Achievements ${onOff(a.achievements)}`);
  if (b.quietStart !== a.quietStart || b.quietEnd !== a.quietEnd) {
    parts.push(a.quietStart ? `Quiet hours ${a.quietStart}–${a.quietEnd}` : 'Quiet hours off');
  }
  return parts.length ? parts.join(' · ') : null;
}

// PATCH /api/profile
const updateProfile = asyncHandler(async (req, res) => {
  const body = req.body;
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  const normalizedGoal = has('fitnessGoal') ? normalizeGoal(body.fitnessGoal) : undefined;
  const before = await buildProfilePayload(req.userId);

  await withTransaction(async (client) => {
    if (has('firstName') || has('lastName')) {
      const current = await User.getById(req.userId, client);
      const firstName = has('firstName') ? body.firstName : current.firstName;
      const lastName = has('lastName') ? body.lastName : current.lastName;
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;
      await User.updateNames(req.userId, { fullName, firstName, lastName }, client);
    }

    const changes = {};
    for (const key of PROFILE_KEYS) {
      if (has(key)) changes[key] = body[key];
    }
    if (Object.keys(changes).length > 0) {
      await User.updateProfile(req.userId, changes, client);
    }

    if (has('fitnessGoal')) {
      await User.setActiveGoal({ userId: req.userId, fitnessGoal: normalizedGoal }, client);
    }

    if (has('weightKg') && body.weightKg !== undefined) {
      const latest = await WeightLog.findLatestByUserId(req.userId, client);
      const unchanged = latest && Number(latest.weightKg) === Number(body.weightKg);
      if (!unchanged) {
        await WeightLog.record({ userId: req.userId, weightKg: body.weightKg }, client);
      }
    }
  });

  const data = await buildProfilePayload(req.userId);

  const changes = await profileChanges(before, data);
  if (changes.length > 0) {
    await logAction(req, { action: 'account.profile.updated', targetType: 'user', details: { changes } });
  }
  if (before.fitnessGoal !== data.fitnessGoal) {
    const goal = await User.getActiveGoal(req.userId).catch(() => null);
    await logAction(req, {
      action: 'account.goal.changed',
      targetType: 'user',
      details: {
        fitnessGoal: data.fitnessGoal,
        previousGoal: before.fitnessGoal ?? 'none',
        effectiveFrom: goal?.effectiveFrom ?? null,
      },
    });
  }
  const notificationChanges = notificationSettingChanges(before, data);
  if (notificationChanges) {
    await logAction(req, {
      action: 'account.notifications.toggled',
      targetType: 'user',
      details: { summary: notificationChanges },
    });
  }

  invalidateRecommendations(req.userId);

  return sendSuccess(res, { message: 'Profile updated', data });
});

const ONBOARDING_TARGETS = [
  'dailyCaloriesKcal', 'dailyProteinG', 'dailyCarbsG', 'dailyFatG', 'dailySteps', 'dailyWaterMl',
];
const ONBOARDING_PROFILE_KEYS = ['workoutPrefs', 'targetWeightKg', 'weeklyPaceKg', 'coachTone', 'notificationPrefs'];

// PUT /api/profile/onboarding
const completeOnboarding = asyncHandler(async (req, res) => {
  const body = req.body;
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  const before = await buildProfilePayload(req.userId);

  await withTransaction(async (client) => {
    const changes = { onboardedAt: new Date() };
    for (const key of ONBOARDING_PROFILE_KEYS) {
      if (has(key)) changes[key] = body[key];
    }
    await User.updateProfile(req.userId, changes, client);

    const targets = {};
    for (const key of ONBOARDING_TARGETS) {
      if (has(key)) targets[key] = body[key];
    }
    if (Object.keys(targets).length > 0) await User.setGoalTargets(req.userId, targets, client);
  });

  const data = await buildProfilePayload(req.userId);

  const changes = await profileChanges(before, data);
  await logAction(req, {
    action: 'account.setup.completed',
    targetType: 'user',
    details: { skipped: Object.keys(body).length === 0, ...(changes.length ? { changes } : {}) },
  });
  const notificationChanges = notificationSettingChanges(before, data);
  if (notificationChanges) {
    await logAction(req, {
      action: 'account.notifications.toggled',
      targetType: 'user',
      details: { summary: notificationChanges },
    });
  }

  invalidateRecommendations(req.userId);
  return sendSuccess(res, { message: 'Setup saved', data });
});

// POST /api/profile/avatar
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    throw ApiError.badRequest('No image was uploaded', { code: 'NO_FILE' });
  }

  const stored = await saveUploadedAvatar(req.userId, req.file.buffer, req.file.mimetype);
  if (!stored) {
    throw ApiError.badRequest(
      'Unsupported file format. Please upload a JPEG, PNG, or WebP image under 2 MB.',
      { code: 'INVALID_IMAGE' },
    );
  }

  await User.updateProfile(req.userId, { avatarStorageKey: stored });
  await logAction(req, { action: 'account.avatar.updated', targetType: 'user' });

  const data = await buildProfilePayload(req.userId);
  return sendSuccess(res, { message: 'Profile photo updated', data });
});

// DELETE /api/profile/avatar
const removeAvatar = asyncHandler(async (req, res) => {
  await User.updateProfile(req.userId, { avatarStorageKey: null });
  await clearStoredAvatar(req.userId);
  await logAction(req, { action: 'account.avatar.removed', targetType: 'user' });

  const data = await buildProfilePayload(req.userId);
  return sendSuccess(res, { message: 'Profile photo removed', data });
});

// ---- Settings > change password -------------------------------------------

async function requireCurrentPassword(req, userId, currentPassword) {
  const user = await User.getById(userId);
  if (!user) throw ApiError.notFound('We couldn\'t find your account. Please sign in again.');
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    await logAction(req, { action: 'auth.password.verify_failed', targetType: 'user' });
    throw ApiError.badRequest('That password is incorrect.', { code: 'WRONG_PASSWORD' });
  }
  return user;
}

// POST /api/profile/password/verify
const verifyCurrentPassword = asyncHandler(async (req, res) => {
  await requireCurrentPassword(req, req.userId, req.body.currentPassword);
  return sendSuccess(res, { message: 'Password confirmed' });
});

// PUT /api/profile/password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await requireCurrentPassword(req, req.userId, currentPassword);

  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw ApiError.badRequest('Your new password must be different from your current password.', {
      code: 'SAME_PASSWORD',
    });
  }

  await User.updatePasswordHash(user.id, await hashPassword(newPassword));
  await logAction(req, {
    action: 'auth.password.changed',
    targetType: 'user',
    targetId: user.id,
    targetLabel: User.displayName(user),
    targetRole: user.role,
  });
  notify(user.id, 'password_changed');

  return sendSuccess(res, { message: 'Password changed' });
});

// DELETE /api/profile
const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.getById(req.userId);
  if (!user) throw ApiError.notFound('We couldn\'t find your account. Please sign in again.');

  await requireCurrentPassword(req, req.userId, req.body.currentPassword);

  if (user.role === 'admin') {
    const counts = await User.countByRole();
    if ((counts.admin || 0) <= 1) {
      throw ApiError.conflict('You are the only admin. Create another admin account first.', {
        code: 'LAST_ADMIN',
      });
    }
  }

  if (user.role !== 'user') {
    if (!req.body.code) throw ApiError.badRequest('Enter your authenticator code or a recovery code.', { code: 'MFA_CODE_REQUIRED' });
    assertNotMfaLocked(user);
    const kind = await checkAuthenticatorCode(user, req.body.code);
    if (!kind) await rejectAuthenticatorCode(req, user, 'delete_account');
    await User.clearMfaFailures(user.id);
    if (kind === 'recovery') noteRecoveryUsed(req, user);
  }

  const deletedCounts = await deleteAccountData(user.id, user.role);

  await logAction(req, {
    action: 'account.deleted',
    targetType: 'user',
    targetId: user.id,
    actorLabel: User.displayName(user),
    targetLabel: User.displayName(user),
    details: { deletedCounts },
  });
  notify(null, 'account_deleted', { email: user.email });

  clearRefreshCookie(res, req);
  return sendSuccess(res, { message: 'Your account has been deleted.' });
});

module.exports = {
  deleteAccount,
  getProfile,
  updateProfile,
  completeOnboarding,
  uploadAvatar,
  removeAvatar,
  verifyCurrentPassword,
  changePassword,
};
