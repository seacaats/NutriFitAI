const QRCode = require('qrcode');
const User = require('../../models/user/User');
const { verifyPassword } = require('../../utils/auth/password');
const {
  generateTotpSecret, matchTotpStep, buildOtpauthUri, encryptMfaSecret, decryptMfaSecret,
  generateRecoveryCodes, hashRecoveryCode,
} = require('../../utils/auth/otp');
const { sendSuccess, ApiError, asyncHandler } = require('../../utils/httpResponse');
const { logAction } = require('../../utils/audit-logs/auditLogger');
const { notify } = require('../../services/notifications/notify');
const {
  mfaMethodOf, needsAuthenticatorSetup, userFromMfaToken, assertNotMfaLocked,
  rejectAuthenticatorCode, checkAuthenticatorCode, noteRecoveryUsed,
} = require('../../services/auth/mfa');
const { issueAndSendOtp, emailFailed, consumeOtpChallenge } = require('../../services/auth/otpChallenge');
const { finishLogin } = require('./loginController');

// POST /api/auth/login/mfa
const loginMfa = asyncHandler(async (req, res) => {
  const { user, rememberMe, via } = await userFromMfaToken(req.body.mfaToken);

  if (needsAuthenticatorSetup(user)) {
    throw ApiError.badRequest('Set up your authenticator app first.', { code: 'MFA_SETUP_REQUIRED' });
  }

  if (mfaMethodOf(user) === 'email') {
    try {
      await consumeOtpChallenge({ userId: user.id, purpose: 'login_mfa', code: req.body.code });
    } catch (err) {
      await logAction(req, { action: 'auth.mfa.failed', targetType: 'user', targetId: user.id, details: { step: 'login' } }, { userId: null, role: null });
      throw err;
    }
    return finishLogin(req, res, user, rememberMe, `${via}+email_code`);
  }

  assertNotMfaLocked(user);
  const kind = await checkAuthenticatorCode(user, req.body.code);
  if (!kind) await rejectAuthenticatorCode(req, user, 'login');
  await User.clearMfaFailures(user.id);
  if (kind === 'recovery') noteRecoveryUsed(req, user);
  return finishLogin(req, res, user, rememberMe, kind === 'recovery' ? `${via}+recovery_code` : `${via}+totp`);
});

// POST /api/auth/login/mfa/resend
const resendLoginMfa = asyncHandler(async (req, res) => {
  const { user } = await userFromMfaToken(req.body.mfaToken);
  if (mfaMethodOf(user) !== 'email') throw ApiError.badRequest('This account uses an authenticator app.');

  if (!(await issueAndSendOtp(user.id, user.email, 'login_mfa'))) throw emailFailed();
  await logAction(req, { action: 'auth.otp.resent', targetType: 'user' }, { userId: user.id, role: user.role });
  return sendSuccess(res, { message: 'A new code has been sent.' });
});

// ---- Admin first-login authenticator setup ---------------------------------------

async function setupUserFromMfaToken(mfaToken) {
  const { user, rememberMe, via } = await userFromMfaToken(mfaToken);
  if (!needsAuthenticatorSetup(user)) throw ApiError.conflict('Your authenticator app is already set up.', { code: 'MFA_ALREADY_SET_UP' });
  assertNotMfaLocked(user);
  return { user, rememberMe, via };
}

// POST /api/auth/login/mfa/setup
const loginMfaSetup = asyncHandler(async (req, res) => {
  const { user } = await setupUserFromMfaToken(req.body.mfaToken);

  const secret = generateTotpSecret();
  await User.startMfaSetup(user.id, encryptMfaSecret(secret, user.id));
  const otpauthUri = buildOtpauthUri({ secret, email: user.email });
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, { errorCorrectionLevel: 'M', margin: 1, width: 224 });

  res.set('Cache-Control', 'no-store');
  return sendSuccess(res, { data: { secret, otpauthUri, qrDataUrl } });
});

// POST /api/auth/login/mfa/enable
const loginMfaEnable = asyncHandler(async (req, res) => {
  const { user, rememberMe, via } = await setupUserFromMfaToken(req.body.mfaToken);

  const pending = user.mfa && user.mfa.pendingSecretEnc;
  if (!pending || !user.mfa.pendingExpiresAt || user.mfa.pendingExpiresAt < new Date()) {
    throw ApiError.badRequest('That setup expired. Start again.', { code: 'MFA_SETUP_EXPIRED' });
  }
  const step = matchTotpStep(decryptMfaSecret(pending, user.id), req.body.code);
  if (step === null) await rejectAuthenticatorCode(req, user, 'setup');

  const recoveryCodes = generateRecoveryCodes();
  const switched = await User.enableMfa(user.id, {
    secretEnc: pending,
    recoveryHashes: recoveryCodes.map(hashRecoveryCode),
    step,
  });
  if (!switched) throw ApiError.conflict('Your authenticator app is already set up.', { code: 'MFA_ALREADY_SET_UP' });

  await logAction(
    req,
    { action: 'auth.mfa.enabled', targetType: 'user', targetId: user.id, targetLabel: User.displayName(user), targetRole: user.role },
    { userId: user.id, role: user.role },
  );
  notify(user.id, 'mfa_enabled');
  res.set('Cache-Control', 'no-store');
  return finishLogin(req, res, user, rememberMe, `${via}+totp`, { recoveryCodes });
});

// ---- Settings: email MFA (regular users) and recovery codes (admins) -------------

async function requirePasswordFor(req, password, method) {
  const user = await User.getById(req.userId);
  if (!user) throw ApiError.notFound("We couldn't find your account.");
  if (mfaMethodOf(user) !== method) throw ApiError.forbidden('That option isn\'t available for this account.');
  if (!(await verifyPassword(password, user.passwordHash))) {
    await logAction(req, { action: 'auth.password.verify_failed', targetType: 'user' });
    throw ApiError.badRequest('That password is incorrect.', { code: 'WRONG_PASSWORD' });
  }
  return user;
}

const mfaAudit = (req, user, action) =>
  logAction(req, { action, targetType: 'user', targetId: user.id, targetLabel: User.displayName(user), targetRole: user.role });

// POST /api/auth/mfa/email/request
const mfaEmailRequest = asyncHandler(async (req, res) => {
  const user = await requirePasswordFor(req, req.body.password, 'email');
  if (!(await issueAndSendOtp(user.id, user.email, 'mfa_change'))) throw emailFailed();
  return sendSuccess(res, { message: 'We sent a code to your email.' });
});

// POST /api/auth/mfa/email/confirm
const mfaEmailConfirm = asyncHandler(async (req, res) => {
  const user = await User.getById(req.userId);
  if (!user || mfaMethodOf(user) !== 'email') throw ApiError.forbidden('That option isn\'t available for this account.');

  await consumeOtpChallenge({ userId: user.id, purpose: 'mfa_change', code: req.body.code });
  await User.setEmailMfa(user.id, req.body.enable);
  await mfaAudit(req, user, req.body.enable ? 'auth.mfa.enabled' : 'auth.mfa.disabled');
  notify(user.id, req.body.enable ? 'mfa_enabled' : 'mfa_disabled');
  return sendSuccess(res, { message: req.body.enable ? 'Two-factor sign-in is on.' : 'Two-factor sign-in is off.', data: { mfaEnabled: req.body.enable } });
});

async function requireAuthenticatorProof(req) {
  const user = await requirePasswordFor(req, req.body.password, 'totp');
  if (!user.mfa || !user.mfa.enabled) throw ApiError.badRequest('Two-factor sign-in is off.');
  assertNotMfaLocked(user);
  const kind = await checkAuthenticatorCode(user, req.body.code);
  if (!kind) await rejectAuthenticatorCode(req, user, 'settings');
  await User.clearMfaFailures(user.id);
  return user;
}

// POST /api/auth/mfa/recovery-codes
const mfaRecoveryCodes = asyncHandler(async (req, res) => {
  const user = await requireAuthenticatorProof(req);
  const recoveryCodes = generateRecoveryCodes();
  await User.replaceRecoveryHashes(user.id, recoveryCodes.map(hashRecoveryCode));
  await mfaAudit(req, user, 'auth.mfa.recovery_regenerated');
  res.set('Cache-Control', 'no-store');
  return sendSuccess(res, { message: 'New recovery codes generated.', data: { recoveryCodes } });
});

module.exports = {
  loginMfa,
  resendLoginMfa,
  loginMfaSetup,
  loginMfaEnable,
  mfaEmailRequest,
  mfaEmailConfirm,
  mfaRecoveryCodes,
};
