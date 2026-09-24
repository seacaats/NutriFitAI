const { withTransaction } = require('../../config/mongo');
const User = require('../models/user/User');
const UserProfile = require('../models/user/UserProfile');
const UserGoal = require('../models/user/UserGoal');
const WeightLog = require('../models/user/WeightLog');

const { normalizeGoal } = require('../utils/goalNormalizer');
const { sendSuccess, ApiError, asyncHandler } = require('../utils/httpResponse');
const { saveUploadedAvatar, clearStoredAvatar, toPublicAvatarUrl } = require('../utils/avatarStore');


// Used by GET /profile and response returned after PATCH /profile since
// they need the same shape of data anyway, so no refetches are made for syncing
async function buildProfilePayload(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  const profile = await UserProfile.findByUserId(userId);
  const goal = await UserGoal.findActiveByUserId(userId);
  const latestWeight = await WeightLog.findLatestByUserId(userId);

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    emailVerified: Boolean(user.emailVerifiedAt),
    role: user.role || 'user',
    createdAt: user.createdAt,

    age: profile?.age ?? null,
    gender: profile?.gender ?? null,
    heightCm: profile?.heightCm ?? null,
    activityLevel: profile?.activityLevel ?? null,
    dietPreference: profile?.dietPreference ?? null,
    healthConditions: profile?.healthConditions ?? null,
    theme: profile?.theme ?? 'system',
    notificationsEnabled: profile?.notificationsEnabled ?? true,
    timezone: profile?.timezone ?? null,
    avatarUrl: toPublicAvatarUrl(profile?.avatarStorageKey),

    weightKg: latestWeight?.weightKg ?? null,
    weightMeasuredAt: latestWeight?.measuredAt ?? null,
    fitnessGoal: goal?.fitnessGoal ?? null,
  };
}

// GET /api/profile
const getProfile = asyncHandler(async (req, res) => {
  const data = await buildProfilePayload(req.userId);
  return sendSuccess(res, { data });
});

// PATCH /api/profile
const updateProfile = asyncHandler(async (req, res) => {
  const body = req.body;
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  // Email is not updateable. Must wire another verification flow to allow it

  let normalizedGoal;
  if (has('fitnessGoal')) {
    normalizedGoal = body.fitnessGoal === null ? null : normalizeGoal(body.fitnessGoal);
    if (body.fitnessGoal !== null && normalizedGoal === null) {
      throw ApiError.badRequest('Unrecognized fitness goal', { code: 'INVALID_GOAL' });
    }
  }

  await withTransaction(async (client) => {
    // ----- users -----
    if (has('firstName') || has('lastName')) {
      const current = await User.findById(req.userId, client);
      const firstName = has('firstName') ? body.firstName : current.firstName;
      const lastName = has('lastName') ? body.lastName : current.lastName;
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;
      await User.updateNames(req.userId, { fullName, firstName, lastName }, client);
    }

    // ----- user_profiles -----
    const profileChanges = {};
    for (const key of [
      'age',
      'gender',
      'heightCm',
      'activityLevel',
      'dietPreference',
      'healthConditions',
      'timezone',
      'notificationsEnabled',
      'theme',
    ]) {
      if (has(key)) profileChanges[key] = body[key];
    }
    if (Object.keys(profileChanges).length > 0) {
      await UserProfile.upsert(req.userId, profileChanges, client);
    }

    // ----- user_goals (append-only history) -----
    if (has('fitnessGoal')) {
      await UserGoal.setActive({ userId: req.userId, fitnessGoal: normalizedGoal }, client);
    }

    // ----- weight_logs (new measurement, not updated) -----
    if (has('weightKg') && body.weightKg !== undefined) {
      const latest = await WeightLog.findLatestByUserId(req.userId, client);
      const unchanged = latest && Number(latest.weightKg) === Number(body.weightKg);
      if (!unchanged) {
        await WeightLog.create({ userId: req.userId, weightKg: body.weightKg }, client);
      }
    }
  });

  const data = await buildProfilePayload(req.userId);
  return sendSuccess(res, { message: 'Profile updated', data });
});

// POST /api/profile/avatar   (multipart/form-data, field name: "avatar")
const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    throw ApiError.badRequest('No image was uploaded', { code: 'NO_FILE' });
  }

  const stored = await saveUploadedAvatar(req.userId, req.file.buffer, req.file.mimetype);
  if (!stored) {
    throw ApiError.badRequest(
      'That file could not be used. Upload a JPEG, PNG or WebP image under 2 MB.',
      { code: 'INVALID_IMAGE' },
    );
  }

  // Upsert is used since profile is a subdocument which always exists upon
  // boot, never needing to verify that a user or their profile exists.
  // "stored" here though, is just a storage key, not the URL, storing it upon save
  await UserProfile.upsert(req.userId, { avatarStorageKey: stored });

  const data = await buildProfilePayload(req.userId);
  return sendSuccess(res, { message: 'Profile photo updated', data });
});

// DELETE /api/profile/avatar
const removeAvatar = asyncHandler(async (req, res) => {
  await UserProfile.upsert(req.userId, { avatarStorageKey: null });
  await clearStoredAvatar(req.userId);

  const data = await buildProfilePayload(req.userId);
  return sendSuccess(res, { message: 'Profile photo removed', data });
});

module.exports = { getProfile, updateProfile, uploadAvatar, removeAvatar, buildProfilePayload };