const User = require('../../models/user/User');
const WeightLog = require('../../models/user/WeightLog');
const {
  signAccessToken, signRefreshToken, refreshSessionRemainingMs, refreshCookieMaxAgeMs, verifyRefreshToken,
} = require('../../utils/auth/token');
const { REFRESH_COOKIE_NAME, refreshCookieOptions, clearRefreshCookie } = require('../../utils/auth/refreshCookie');
const { toPublicAvatarUrl } = require('../../utils/storage/avatarStore');
const { sendSuccess, ApiError, asyncHandler } = require('../../utils/httpResponse');
const { logAction } = require('../../utils/audit-logs/auditLogger');
const { accountHold } = require('../../services/auth/authResponses');

// api/auth/refresh

// rmb = rememberMe (Seven day window)
// sxp = absolute session deadline (Thirty day window, absolute max)
// No revocation as these are stateless JWTs, meaning stolen cookies
// can still remain valid until sxp
// Implement JWT ID eventually
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
    throw ApiError.unauthorized('No refresh session found. Please log in again.');
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
    if (payload.type !== 'refresh') throw new Error('wrong token type');
  } catch (err) {
    // Clears refresh cookies on any validation failure
    clearRefreshCookie(res, req);
    // Unverified token, so its subject can't be trusted -- recorded without one
    await rejectRefresh(req, null, err.name === 'TokenExpiredError' ? 'expired' : 'invalid');
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }

  const user = await User.getById(payload.sub);
  if (!user) {
    clearRefreshCookie(res, req);
    await rejectRefresh(req, payload.sub, 'account_missing');
    throw ApiError.unauthorized('This account no longer exists.');
  }

  // Ends existing sessions within one access-token lifetime of the hold
  const hold = accountHold(user);
  if (hold) {
    clearRefreshCookie(res, req);
    await rejectRefresh(req, user.id, hold.reason);
    throw hold.error;
  }

  const accessToken = signAccessToken(user);


  // Check for sxp, regardless of refresh/replacement cookie
  const remainingMs = refreshSessionRemainingMs(payload);
  if (remainingMs <= 0) {
    clearRefreshCookie(res, req);
    await rejectRefresh(req, user.id, 'session_ceiling');
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }

  const rotated = signRefreshToken(user, Boolean(payload.rmb), payload.sxp || Date.now() + remainingMs);
  // Same options helper as login -- maxAge is min(idle 
  // window, remaining ceiling), see refreshCookieMaxAgeMs
  res.cookie(REFRESH_COOKIE_NAME, rotated, refreshCookieOptions(req, refreshCookieMaxAgeMs(payload)));

  return sendSuccess(res, {
    message: 'Session refreshed',
    data: {
      accessToken,
      user: User.toAuthPayload(user),
    },
  });
});

// api/auth/logout
const logout = asyncHandler(async (req, res) => {
  // Unauthenticated route, so the actor comes from the refresh cookie. No
  // valid cookie means there was no session to end, and nothing is recorded
  let sub = null;
  try {
    const payload = verifyRefreshToken(req.cookies[REFRESH_COOKIE_NAME]);
    if (payload.type === 'refresh') sub = payload.sub;
  } catch {
    sub = null;
  }
  if (sub) {
    await logAction(req, { action: 'auth.logout', targetType: 'user' }, { userId: sub });
  }

  clearRefreshCookie(res, req);
  return sendSuccess(res, { message: 'Logged out' });
});

// api/auth/me
const me = asyncHandler(async (req, res) => {
  const user = await User.getById(req.userId);
  if (!user) {
    throw ApiError.notFound('User not found');
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
      // Setup wizard: shown until onboarded, then a banner while it's all empty
      onboarded: Boolean(profile?.onboardedAt),
      setupPending: User.isSetupPending(profile, goal),
    },
  });
});

module.exports = { refresh, logout, me };