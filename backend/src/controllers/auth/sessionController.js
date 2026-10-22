const User = require('../../models/user/User');
const Session = require('../../models/auth/Session');
const WeightLog = require('../../models/user/WeightLog');
const {
  signAccessToken, signRefreshToken, refreshSessionRemainingMs, refreshCookieMaxAgeMs, verifyRefreshToken,
} = require('../../utils/auth/token');
const { REFRESH_COOKIE_NAME, refreshCookieOptions, clearRefreshCookie } = require('../../utils/auth/refreshCookie');
const { toPublicAvatarUrl } = require('../../utils/storage/avatarStore');
const { sendSuccess, ApiError, asyncHandler } = require('../../utils/httpResponse');
const { logAction } = require('../../utils/audit-logs/auditLogger');
const { accountHold } = require('../../services/auth/authResponses');

// POST /api/auth/refresh
function rejectRefresh(req, targetId, reason) {
  return logAction(
    req,
    { action: 'auth.token.refresh_rejected', targetType: 'user', targetId, details: { reason } },
    { userId: null, role: null },
  );
}

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies[REFRESH_COOKIE_NAME];
  if (!token) {
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
    if (payload.type !== 'refresh') throw new Error('wrong token type');
  } catch (err) {
    clearRefreshCookie(res, req);
    await rejectRefresh(req, null, err.name === 'TokenExpiredError' ? 'expired' : 'invalid');
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }

  const user = await User.getById(payload.sub);
  if (!user) {
    clearRefreshCookie(res, req);
    await rejectRefresh(req, payload.sub, 'account_missing');
    throw ApiError.unauthorized('This account no longer exists.');
  }

  const hold = accountHold(user);
  if (hold) {
    clearRefreshCookie(res, req);
    await rejectRefresh(req, user.id, hold.reason);
    throw hold.error;
  }

  const remainingMs = refreshSessionRemainingMs(payload);
  if (remainingMs <= 0) {
    clearRefreshCookie(res, req);
    await rejectRefresh(req, user.id, 'session_ceiling');
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }

  // Validate active session row (or create one for legacy tokens without sid)
  const expiresAt = new Date(Date.now() + refreshCookieMaxAgeMs(payload));
  let sid = payload.sid;
  if (sid) {
    if (!(await Session.touch(sid, user.id, expiresAt))) {
      clearRefreshCookie(res, req);
      await rejectRefresh(req, user.id, 'session_revoked');
      throw ApiError.unauthorized('Your session has ended. Please log in again.');
    }
  } else {
    sid = (await Session.open(user.id, { ip: req.ip, userAgent: req.get('user-agent'), expiresAt })).id;
  }

  const accessToken = signAccessToken(user, sid);
  const rotated = signRefreshToken(user, Boolean(payload.rmb), payload.sxp || Date.now() + remainingMs, sid);
  res.cookie(REFRESH_COOKIE_NAME, rotated, refreshCookieOptions(req, refreshCookieMaxAgeMs(payload)));

  return sendSuccess(res, {
    message: 'Session refreshed',
    data: {
      accessToken,
      user: User.toAuthPayload(user),
    },
  });
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  let sub = null;
  let sid = null;
  try {
    const payload = verifyRefreshToken(req.cookies[REFRESH_COOKIE_NAME]);
    if (payload.type === 'refresh') {
      sub = payload.sub;
      sid = payload.sid || null;
    }
  } catch {
    sub = null;
  }
  if (sub) {
    if (sid) await Session.revoke(sub, sid).catch(() => {});
    await logAction(req, { action: 'auth.logout', targetType: 'user' }, { userId: sub });
  }

  clearRefreshCookie(res, req);
  return sendSuccess(res, { message: 'Logged out' });
});

// GET /api/auth/me
const me = asyncHandler(async (req, res) => {
  const user = await User.getById(req.userId);
  if (!user) {
    throw ApiError.notFound("We couldn't find your account.");
  }

  const profile = await User.getProfile(req.userId);
  const goal = await User.getActiveGoal(req.userId);
  const latestWeight = await WeightLog.findLatestByUserId(req.userId);

  return sendSuccess(res, {
    data: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: Boolean(user.emailVerifiedAt),
      role: user.role || 'user',
      createdAt: user.createdAt,
      age: profile?.age ?? null,
      heightCm: profile?.heightCm ?? null,
      sex: profile?.sex ?? null,
      activityLevel: profile?.activityLevel ?? null,
      dietPreference: profile?.dietPreference ?? null,
      healthConditions: profile?.healthConditions ?? null,
      notificationsEnabled: profile?.notificationsEnabled ?? true,
      avatarUrl: await toPublicAvatarUrl(profile?.avatarStorageKey),
      weightKg: latestWeight?.weightKg ?? null,
      fitnessGoal: goal?.fitnessGoal ?? null,
      onboarded: Boolean(profile?.onboardedAt),
      setupPending: User.isSetupPending(profile, goal),
    },
  });
});

module.exports = { refresh, logout, me };
