const User = require('../../models/user/User');
const Session = require('../../models/auth/Session');
const AuthIdentity = require('../../models/auth/AuthIdentity');
const AuthChallenge = require('../../models/auth/AuthChallenge');
const { signAccessToken } = require('../../utils/auth/token');
const { verifyPassword } = require('../../utils/auth/password');
const { otpExpiryDate } = require('../../utils/auth/otp');
const { sendSuccess, ApiError, asyncHandler } = require('../../utils/httpResponse');
const { logAction } = require('../../utils/audit-logs/auditLogger');
const { notify } = require('../../services/notifications/notify');
const { INVALID_CODE_MESSAGE } = require('../../services/auth/authResponses');
const { sendRegistrationNotice } = require('./registrationController');
const { issueAndSendOtp, emailFailed, consumeOtpChallenge } = require('../../services/auth/otpChallenge');

async function requireRegularUser(req) {
  const user = await User.getById(req.userId);
  if (!user) throw ApiError.notFound("We couldn't find your account.");
  if (user.role !== 'user') throw ApiError.forbidden("That option isn't available for this account.");
  return user;
}

// POST /api/auth/email/request
const requestEmailChange = asyncHandler(async (req, res) => {
  const user = await requireRegularUser(req);

  if (!(await verifyPassword(req.body.password, user.passwordHash))) {
    await logAction(req, { action: 'auth.password.verify_failed', targetType: 'user' });
    throw ApiError.badRequest('That password is incorrect.', { code: 'WRONG_PASSWORD' });
  }

  const { newEmail } = req.body;
  if (newEmail === user.email) {
    throw ApiError.badRequest('That is already your email.', { code: 'SAME_EMAIL' });
  }

  // Respond identically when newEmail is already registered to prevent account enumeration
  if (await User.findByEmail(newEmail)) {
    sendRegistrationNotice(newEmail.toLowerCase(), { emailChange: true });
  } else {
    await User.setPendingEmail(user.id, newEmail, otpExpiryDate());
    if (!(await issueAndSendOtp(user.id, newEmail, 'email_change'))) throw emailFailed();
  }

  await logAction(req, {
    action: 'auth.email.change_requested',
    targetType: 'user',
    targetId: user.id,
    targetLabel: User.displayName(user),
    hash: { newEmailHash: newEmail },
  });
  return sendSuccess(res, { message: 'If that address can be used, we sent a code to it.' });
});

// POST /api/auth/email/confirm
const confirmEmailChange = asyncHandler(async (req, res) => {
  const user = await requireRegularUser(req);

  await consumeOtpChallenge({ userId: user.id, purpose: 'email_change', code: req.body.code });

  let before;
  try {
    before = await User.applyPendingEmail(user.id);
  } catch (err) {
    if (err?.code === 11000) throw ApiError.conflict("That email can't be used.", { code: 'EMAIL_UNAVAILABLE' });
    throw err;
  }
  if (!before) throw ApiError.badRequest(INVALID_CODE_MESSAGE, { code: 'INVALID_CODE' });

  // Invalidate any other active device sessions
  await Session.revokeAll(user.id, null, req.sessionId);

  // Unlink all external OAuth identities (e.g. Google) bound to the old email address.
  // This prevents the old Google account from signing into this account under the new email.
  await AuthIdentity.deleteMany({ userId: user.id });

  // Invalidate any other outstanding OTP challenges issued for the old address
  await AuthChallenge.invalidateActive(user.id);

  // Issue a fresh access token carrying the updated email claim for the current session
  const updatedUser = { ...user, email: before.pendingEmail };
  const accessToken = signAccessToken(updatedUser, req.sessionId);

  await logAction(req, {
    action: 'auth.email.changed',
    targetType: 'user',
    targetId: user.id,
    targetLabel: User.displayName(user),
    hash: { oldEmailHash: before.email, newEmailHash: before.pendingEmail },
  });
  notify(user.id, 'email_changed', { vars: { oldEmail: before.email, newEmail: before.pendingEmail } });
  notify(null, 'email_changed_security_alert', {
    email: before.email,
    vars: { oldEmail: before.email, newEmail: before.pendingEmail },
  });

  return sendSuccess(res, {
    message: 'Your email was changed.',
    data: {
      email: before.pendingEmail,
      accessToken,
      user: User.toAuthPayload(updatedUser),
    },
  });
});

module.exports = { requestEmailChange, confirmEmailChange };
