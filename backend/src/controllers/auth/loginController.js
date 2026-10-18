const crypto = require('crypto');
const User = require('../../models/user/User');
const { hashPassword, verifyPassword } = require('../../utils/auth/password');
const { signAccessToken, signRefreshToken, signMfaToken } = require('../../utils/auth/token');
const { setRefreshCookie } = require('../../utils/auth/refreshCookie');
const { sendSuccess, ApiError, asyncHandler } = require('../../utils/httpResponse');
const { logAction } = require('../../utils/audit-logs/auditLogger');
const { INVALID_LOGIN_MESSAGE, accountHold } = require('../../services/auth/authResponses');
const { mfaMethodOf, needsAuthenticatorSetup } = require('../../services/auth/mfa');
const { issueAndSendOtp, emailFailed } = require('../../services/auth/otpChallenge');

// bcrypt hash of a throwaway value, compared against when the email is unknown
// so a miss costs the same ~bcrypt time as a hit. Computed once, lazily
let dummyHashPromise = null;
function dummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(crypto.randomUUID());
  return dummyHashPromise;
}

// api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const user = await User.findByEmail(email);

  // Always runs bcrypt (against a dummy hash for unknown emails) so response
  // time doesn't reveal whether the account exists
  const passwordOk = await verifyPassword(password, user?.passwordHash || (await dummyHash()));

  // Unknown email, unverified account and wrong password all look the same.
  // An unverified user recovers by registering again, which resends a code
  if (!user || !passwordOk || !user.emailVerifiedAt) {
    // No actor: the request isn't authenticated. The account, when there is
    // one, is the target. The email itself is only ever stored hashed
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

  // Two-factor on: no session yet, only a challenge for the second step
  if (user.mfa && user.mfa.enabled) return startMfaChallenge(res, user, rememberMe, 'password');

  return finishLogin(req, res, user, rememberMe, 'password');
});

// Shared with the Google and two-factor controllers, which finish the same sign-in
// Audit entry for a sign-in refused because of an admin hold. The caller
// throws hold.error afterwards
function logHeldLogin(req, user, hold) {
  return logAction(
    req,
    { action: 'auth.login.failed', targetType: 'user', targetId: user.id, targetRole: user.role, details: { reason: hold.reason } },
    { userId: null, role: null },
  );
}

// Tokens, cookie and audit entry for a completed sign-in. `extra` rides along in
// the response data (the recovery codes, on an admin's first sign-in)
async function finishLogin(req, res, user, rememberMe, method, extra = {}) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, rememberMe);
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

// The second step for a sign-in whose first step went through. No session yet: a
// challenge token, plus the emailed code for regular users. `via` ('password' or
// 'google') rides in the token and ends up in the audit entry of the finished sign-in
async function startMfaChallenge(res, user, rememberMe, via) {
  const method = mfaMethodOf(user);
  if (method === 'email') {
    if (!(await issueAndSendOtp(user.id, user.email, 'login_mfa'))) throw emailFailed();
  }
  // An admin who hasn't set up the authenticator yet gets the setup instead of a
  // code prompt (first sign-in), on the same screen and with the same token
  const setupRequired = needsAuthenticatorSetup(user);
  return sendSuccess(res, {
    message: setupRequired
      ? 'Set up your authenticator app to finish signing in.'
      : 'Enter your verification code to finish signing in.',
    data: { mfaRequired: true, mfaMethod: method, mfaSetupRequired: setupRequired, mfaToken: signMfaToken(user, rememberMe, via) },
  });
}

module.exports = { login, finishLogin, startMfaChallenge, logHeldLogin };