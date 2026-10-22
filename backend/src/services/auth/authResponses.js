// Shared auth response copy, timing normalization, and account-hold checks.
// Messages are kept uniform across failure causes to prevent account enumeration.

const { ApiError } = require('../../utils/httpResponse');

const INVALID_CODE_MESSAGE = 'Invalid or expired code. Check your latest email or request a new code.';
const INVALID_LOGIN_MESSAGE = 'Invalid email or password';
const REGISTER_ACCEPTED_MESSAGE = 'Registration received. Check your email for a verification code.';
const EMAIL_FAILED_MESSAGE = "We couldn't send the email right now. Please try again in a moment.";

// Minimum response floor for register, resend, and forgot-password to prevent timing leaks
const MIN_RESPONSE_MS = 3000;

function padResponse(startedAt) {
  const remaining = MIN_RESPONSE_MS - (Date.now() - startedAt);
  return remaining > 0 ? new Promise((resolve) => setTimeout(resolve, remaining)) : null;
}

// Evaluates admin holds after credentials are verified
function accountHold(user) {
  if (user.suspendedAt) {
    const parts = ['This account has been suspended.'];
    if (user.deletionScheduledFor) {
      const date = new Date(user.deletionScheduledFor).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
      parts.push(`It is scheduled to be deleted on ${date}.`);
    }
    if (user.suspendedUserMessage) parts.push(`Message from the administrator: "${user.suspendedUserMessage}"`);
    parts.push('Contact support.');
    return { reason: 'suspended', error: ApiError.forbidden(parts.join(' '), { code: 'ACCOUNT_SUSPENDED' }) };
  }
  if (user.passwordResetRequiredAt) {
    return {
      reason: 'reset_required',
      error: ApiError.forbidden('A password reset is required. Use "Forgot password" to set a new one.', {
        code: 'PASSWORD_RESET_REQUIRED',
      }),
    };
  }
  return null;
}

module.exports = {
  INVALID_CODE_MESSAGE,
  INVALID_LOGIN_MESSAGE,
  REGISTER_ACCEPTED_MESSAGE,
  EMAIL_FAILED_MESSAGE,
  MIN_RESPONSE_MS,
  padResponse,
  accountHold,
};
