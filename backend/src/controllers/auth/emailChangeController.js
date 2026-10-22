const User = require('../../models/user/User');
const Session = require('../../models/auth/Session');
const { verifyPassword } = require('../../utils/auth/password');
const { otpExpiryDate } = require('../../utils/auth/otp');
const { sendSuccess, ApiError, asyncHandler } = require('../../utils/httpResponse');
const { logAction } = require('../../utils/audit-logs/auditLogger');
const { notify } = require('../../services/notifications/notify');
const { INVALID_CODE_MESSAGE } = require('../../services/auth/authResponses');
const { sendRegistrationNotice } = require('./registrationController');
const { issueAndSendOtp, emailFailed, consumeOtpChallenge } = require('../../services/auth/otpChallenge');

// Changing the email, signed in. The new address is proven with a code sent to it,
// and the password is asked again so a borrowed session can't redirect the account.
// Regular users only: an admin's address stays out of band like the account itself

async function requireRegularUser(req) {
  const user = await User.getById(req.userId);
  if (!user) throw ApiError.notFound("We couldn't find your account.");
  if (user.role !== 'user') throw ApiError.forbidden("That option isn't available for this account.");
  return user;
}

// POST /api/auth/email/request { newEmail, password } -- sends the code to the new address
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

  // A taken address answers like a free one (no code is sent), so this can't be
  // used to find out who has an account. Its owner gets a notice instead, as
  // in register. The confirm step then fails as usual
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

// POST /api/auth/email/confirm { code } -- the address changes, other devices are signed out
const confirmEmailChange = asyncHandler(async (req, res) => {
  const user = await requireRegularUser(req);

  await consumeOtpChallenge({ userId: user.id, purpose: 'email_change', code: req.body.code });

  let before;
  try {
    before = await User.applyPendingEmail(user.id);
  } catch (err) {
    // Taken by someone else between the request and now
    if (err?.code === 11000) throw ApiError.conflict("That email can't be used.", { code: 'EMAIL_UNAVAILABLE' });
    throw err;
  }
  if (!before) throw ApiError.badRequest(INVALID_CODE_MESSAGE, { code: 'INVALID_CODE' });

  // Everywhere else signs in again with the new address. This device stays
  await Session.revokeAll(user.id, null, req.sessionId);

  await logAction(req, {
    action: 'auth.email.changed',
    targetType: 'user',
    targetId: user.id,
    targetLabel: User.displayName(user),
    hash: { oldEmailHash: before.email, newEmailHash: before.pendingEmail },
  });
  // The new address and inbox, and the old address too: it's where a hijack would be noticed
  notify(user.id, 'email_changed');
  notify(null, 'email_changed', { email: before.email });

  return sendSuccess(res, { message: 'Your email was changed.', data: { email: before.pendingEmail } });
});

module.exports = { requestEmailChange, confirmEmailChange };