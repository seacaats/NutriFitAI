const User = require('../../models/user/User');
const AuthChallenge = require('../../models/auth/AuthChallenge');
const { hashPassword, verifyPassword } = require('../../utils/auth/password');
const { signResetToken, verifyResetToken } = require('../../utils/auth/token');
const { sendSuccess, ApiError, asyncHandler } = require('../../utils/httpResponse');
const { logAction } = require('../../utils/audit-logs/auditLogger');
const { notify } = require('../../services/notifications/notify');
const { INVALID_CODE_MESSAGE, padResponse } = require('../../services/auth/authResponses');
const { issueAndSendOtp, emailFailed, consumeOtpChallenge } = require('../../services/auth/otpChallenge');

// POST /api/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  const { email } = req.body;
  const user = await User.findByEmail(email);

  let emailSent = true;
  if (user) {
    emailSent = await issueAndSendOtp(user.id, user.email, 'password_reset');
    await logAction(
      req,
      { action: 'auth.password.reset_requested', targetType: 'user' },
      { userId: user.id, role: user.role },
    );
  }

  await padResponse(startedAt);
  if (!emailSent) throw emailFailed();
  return sendSuccess(res, {
    message: 'If an account exists for this email, a reset code has been sent.',
  });
});

// POST /api/auth/verify-password-reset
const verifyPasswordReset = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  const user = await User.findByEmail(email);
  if (!user) {
    throw ApiError.badRequest(INVALID_CODE_MESSAGE, { code: 'INVALID_CODE' });
  }

  const challenge = await consumeOtpChallenge({ userId: user.id, purpose: 'password_reset', code });
  const resetToken = signResetToken({ userId: user.id, challengeId: challenge.id });
  await logAction(
    req,
    { action: 'auth.password.reset_otp_verified', targetType: 'user' },
    { userId: user.id, role: user.role },
  );

  return sendSuccess(res, {
    message: 'Code verified',
    data: { resetToken },
  });
});

// POST /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, password } = req.body;

  let payload;
  try {
    payload = verifyResetToken(resetToken);
    if (payload.type !== 'password_reset') throw new Error('wrong token type');
  } catch {
    throw ApiError.unauthorized('Your reset session has expired. Please start over.');
  }

  const challenge = await AuthChallenge.getById(payload.cid);
  if (!challenge || !challenge.consumedAt || challenge.userId !== payload.sub) {
    throw ApiError.unauthorized('Your reset session has expired. Please start over.');
  }

  const user = await User.getById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('Your reset session has expired. Please start over.');
  }

  if (await verifyPassword(password, user.passwordHash)) {
    throw ApiError.badRequest('Your new password must be different from your current password.', {
      code: 'SAME_PASSWORD',
    });
  }

  const passwordHash = await hashPassword(password);
  await User.updatePasswordHash(user.id, passwordHash);
  await logAction(
    req,
    { action: 'auth.password.reset_completed', targetType: 'user' },
    { userId: user.id, role: user.role },
  );
  notify(user.id, 'password_reset');

  return sendSuccess(res, { message: 'Password has been reset. Please log in with your new password.' });
});

module.exports = { forgotPassword, verifyPasswordReset, resetPassword };
