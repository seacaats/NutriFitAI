// Fixed response copy, response timing and the account-hold check shared by
// the auth controllers. Messages are deliberately identical across several
// failure causes (see the comments).

const { ApiError } = require('../../utils/httpResponse');

// One message for every OTP failure (no active code, expired, wrong, too many
// attempts, unknown or already-verified email). Distinct messages would tell a
// caller which emails have pending challenges, i.e. which accounts exist
const INVALID_CODE_MESSAGE = 'Invalid or expired code. Check your latest email or request a new code.';

// Same reasoning for sign-in: unknown email, unverified account and wrong
// password are indistinguishable from outside
const INVALID_LOGIN_MESSAGE = 'Invalid email or password';

// Identical body for every /register outcome (new, pending, already verified)
const REGISTER_ACCEPTED_MESSAGE = 'Registration received. Check your email for a verification code.';

// Shown only when the mail provider rejected the send, so the code never left.
const EMAIL_FAILED_MESSAGE = "We couldn't send the email right now. Please try again in a moment.";

// Register, resend and forgot-password all answer after at least this long,
// so a fast path (unknown or verified email) can't be told apart by timing
const MIN_RESPONSE_MS = 3000;

// Waits out whatever is left of MIN_RESPONSE_MS since `startedAt`
function padResponse(startedAt) {
  const remaining = MIN_RESPONSE_MS - (Date.now() - startedAt);
  return remaining > 0 ? new Promise((resolve) => setTimeout(resolve, remaining)) : null;
}

// Admin holds on an account, checked only after the credentials are proven,
// so neither one reveals that an email exists. null when sign-in may proceed
function accountHold(user) {
  if (user.suspendedAt) {
    return { reason: 'suspended', error: ApiError.forbidden('This account has been suspended. Contact support.', { code: 'ACCOUNT_SUSPENDED' }) };
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