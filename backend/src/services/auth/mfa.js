const User = require('../../models/user/User');
const { matchTotpStep, decryptMfaSecret, isRecoveryCodeShape, hashRecoveryCode } = require('../../utils/auth/otp');
const { verifyMfaToken, passwordFingerprint } = require('../../utils/auth/token');
const { ApiError } = require('../../utils/httpResponse');
const { logAction } = require('../../utils/audit-logs/auditLogger');
const { notify } = require('../notifications/notify');
const { accountHold } = require('./authResponses');
const env = require('../../../config/env');

// ---- Two-factor sign-in --------------------------------------------------------
// Regular users get a code by email, the same OTP process as registration and
// password reset, and choose whether to have it. Admins always
// have it, with an authenticator app (TOTP) and recovery codes: their accounts are
// created with it on, and the app is scanned in at their first sign-in. Every
// sign-in goes through it, whether the first step was the password or Google:
// Google only stands in for typing the password, never for the second step

const mfaMethodOf = (user) => (user.role === 'user' ? 'email' : 'totp');

// On, but nothing scanned in yet: a new or just-promoted admin, or an existing one
// the migration switched on
const needsAuthenticatorSetup = (user) => mfaMethodOf(user) === 'totp' && !(user.mfa && user.mfa.secretEnc);

const MFA_SESSION_MESSAGE = 'Your sign-in session expired. Please log in again.';

// The user behind a challenge token, or a 401 for anything off: bad or expired
// token, password changed since, two-factor switched off, account on hold
async function userFromMfaToken(mfaToken) {
  const expired = () => ApiError.unauthorized(MFA_SESSION_MESSAGE, { code: 'MFA_SESSION_EXPIRED' });
  let payload;
  try {
    payload = verifyMfaToken(mfaToken);
  } catch {
    throw expired();
  }
  const user = await User.getById(payload.sub);
  if (!user || !user.emailVerifiedAt || !user.mfa || !user.mfa.enabled || accountHold(user)) throw expired();
  if (payload.pv !== passwordFingerprint(user.passwordHash)) throw expired();
  return { user, rememberMe: Boolean(payload.rmb), via: payload.via || 'password' };
}

const minutesLeft = (date) => Math.max(1, Math.ceil((date.getTime() - Date.now()) / 60000));

function assertNotMfaLocked(user) {
  const until = user.mfa && user.mfa.lockedUntil;
  if (until && until > new Date()) {
    throw ApiError.tooManyRequests(
      `Too many incorrect codes. Try again in ${minutesLeft(until)} minutes.`,
      { code: 'MFA_LOCKED' },
    );
  }
}

// Counts a wrong authenticator code. The account locks after
// MFA_MAX_FAILED_ATTEMPTS in a row, however many IPs they come from
async function rejectAuthenticatorCode(req, user, step) {
  const lockedUntil = await User.recordMfaFailure(user.id, {
    max: env.mfa.maxFailedAttempts,
    lockMs: env.mfa.lockMinutes * 60 * 1000,
  });
  await logAction(
    req,
    { action: lockedUntil ? 'auth.mfa.locked' : 'auth.mfa.failed', targetType: 'user', targetId: user.id, details: { step } },
    { userId: null, role: null },
  );
  if (lockedUntil) {
    throw ApiError.tooManyRequests(
      `Too many incorrect codes. Try again in ${minutesLeft(lockedUntil)} minutes.`,
      { code: 'MFA_LOCKED' },
    );
  }
  throw ApiError.unauthorized('That code is incorrect.', { code: 'INVALID_MFA_CODE' });
}

// 'totp' for an app code, 'recovery' for a one-time recovery code, else null.
// Both are single use: a step is claimed atomically, a recovery code removed
async function checkAuthenticatorCode(user, code) {
  const clean = String(code).replace(/\s/g, '');
  if (/^\d{6}$/.test(clean)) {
    const step = matchTotpStep(decryptMfaSecret(user.mfa.secretEnc, user.id), clean);
    return step !== null && (await User.claimTotpStep(user.id, step)) ? 'totp' : null;
  }
  if (isRecoveryCodeShape(clean)) {
    return (await User.consumeRecoveryHash(user.id, hashRecoveryCode(clean))) ? 'recovery' : null;
  }
  return null;
}

// Not awaited by callers: a failed email mustn't undo a sign-in
function noteRecoveryUsed(req, user) {
  logAction(req, { action: 'auth.mfa.recovery_used', targetType: 'user', targetId: user.id }, { userId: user.id, role: user.role }).catch(() => {});
  notify(user.id, 'mfa_recovery_used');
}

module.exports = {
  mfaMethodOf,
  needsAuthenticatorSetup,
  userFromMfaToken,
  assertNotMfaLocked,
  rejectAuthenticatorCode,
  checkAuthenticatorCode,
  noteRecoveryUsed,
};