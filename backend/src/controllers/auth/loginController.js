const crypto = require('crypto');
const User = require('../../models/user/User');
const { hashPassword, verifyPassword } = require('../../utils/auth/password');
const { signAccessToken, signRefreshToken, signMfaToken, refreshTokenMaxAgeMs } = require('../../utils/auth/token');
const Session = require('../../models/auth/Session');
const { setRefreshCookie } = require('../../utils/auth/refreshCookie');
const { sendSuccess, ApiError, asyncHandler } = require('../../utils/httpResponse');
const { logAction } = require('../../utils/audit-logs/auditLogger');
const { INVALID_LOGIN_MESSAGE, accountHold } = require('../../services/auth/authResponses');
const { mfaMethodOf, needsAuthenticatorSetup } = require('../../services/auth/mfa');
const { issueAndSendOtp, emailFailed } = require('../../services/auth/otpChallenge');

// Lazy dummy hash for constant-time password verification when the email is unknown
let dummyHashPromise = null;
function dummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(crypto.randomUUID());
  return dummyHashPromise;
}

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const user = await User.findByEmail(email);
  const passwordOk = await verifyPassword(password, user?.passwordHash || (await dummyHash()));

  if (!user || !passwordOk || !user.emailVerifiedAt) {
    let reason = 'unverified';
    if (!user) reason = 'unknown_email';
    else if (!passwordOk) reason = 'wrong_password';
    await logAction(
      req,
      {
        action: 'auth.login.failed',
        targetType: 'user',
        targetId: user?.id ?? null,
        targetRole: user?.role ?? null,
        details: { reason },
        hash: { emailHash: String(email).toLowerCase() },
      },
      { userId: null, role: null },
    );
    throw ApiError.unauthorized(INVALID_LOGIN_MESSAGE, { code: 'INVALID_CREDENTIALS' });
  }

  const hold = accountHold(user);
  if (hold) {
    await logHeldLogin(req, user, hold);
    throw hold.error;
  }

  if (user.mfa && user.mfa.enabled) return startMfaChallenge(res, user, rememberMe, 'password');

  return finishLogin(req, res, user, rememberMe, 'password');
});

function logHeldLogin(req, user, hold) {
  return logAction(
    req,
    { action: 'auth.login.failed', targetType: 'user', targetId: user.id, targetRole: user.role, details: { reason: hold.reason } },
    { userId: null, role: null },
  );
}

// Open session, set refresh cookie, and return access token + user payload
async function finishLogin(req, res, user, rememberMe, method, extra = {}) {
  const session = await Session.open(user.id, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    expiresAt: new Date(Date.now() + refreshTokenMaxAgeMs(rememberMe)),
  });
  const accessToken = signAccessToken(user, session.id);
  const refreshToken = signRefreshToken(user, rememberMe, null, session.id);
  setRefreshCookie(res, refreshToken, rememberMe, req);

  await logAction(
    req,
    { action: 'auth.login.succeeded', targetType: 'user', details: { method, rememberMe: Boolean(rememberMe) } },
    { userId: user.id, role: user.role },
  );

  return sendSuccess(res, {
    message: 'Login successful',
    data: {
      accessToken,
      user: User.toAuthPayload(user),
      ...extra,
    },
  });
}

// Issue second-factor challenge token (and email OTP for regular users)
async function startMfaChallenge(res, user, rememberMe, via) {
  const method = mfaMethodOf(user);
  if (method === 'email') {
    if (!(await issueAndSendOtp(user.id, user.email, 'login_mfa'))) throw emailFailed();
  }
  const setupRequired = needsAuthenticatorSetup(user);
  return sendSuccess(res, {
    message: setupRequired
      ? 'Set up your authenticator app to finish signing in.'
      : 'Enter your verification code to finish signing in.',
    data: { mfaRequired: true, mfaMethod: method, mfaSetupRequired: setupRequired, mfaToken: signMfaToken(user, rememberMe, via) },
  });
}

module.exports = { login, finishLogin, startMfaChallenge, logHeldLogin };
