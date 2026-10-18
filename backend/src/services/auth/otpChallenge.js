const { withTransaction } = require('../../../config/mongo');
const AuthChallenge = require('../../models/auth/AuthChallenge');
const { generateOtp, hashOtp, verifyOtp, otpExpiryDate } = require('../../utils/auth/otp');
const { ApiError } = require('../../utils/httpResponse');
const { sendOtpEmail } = require('../mailer');
const { INVALID_CODE_MESSAGE, EMAIL_FAILED_MESSAGE, MIN_RESPONSE_MS } = require('./authResponses');

// Invalidate/Overwrite active challenge for this purpose, issuing a new one
async function issueOtpChallenge(userId, purpose, client) {
  await AuthChallenge.invalidateActive(userId, purpose, client);
  const code = generateOtp();
  const codeHash = await hashOtp(code);
  await AuthChallenge.issue({ userId, purpose, codeHash, expiresAt: otpExpiryDate() }, client);
  return code;
}

// Reported as a failure, 503 so the client shows the message as is
const emailFailed = () => new ApiError(503, EMAIL_FAILED_MESSAGE, { code: 'EMAIL_SEND_FAILED' });

/**
 * Waits for the mail to be accepted, but never longer than MIN_RESPONSE_MS,
 * the same floor every path already answers after. So a known email doesn't
 * answer slower than an unknown one. A send still pending at that point is
 * assumed fine and carries on in the background
 *
 * @returns {Promise<boolean>} false only when the send failed within the wait
 */
async function sendOtpWithinWait(email, code, purpose) {
  const sent = deliverOtpEmail(email, code, purpose);
  const stillPending = new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_MS, true));
  return Promise.race([sent, stillPending]);
}

/**
 * Never throws as the underlying database action already
 * succeeded and can't easily be undone
 * 
 * Called outside the transaction to avoid resending the email
 * again and again which simply leads to spam and duplicate OTPs.
 * Safe to call without awaiting, since it never rejects
 *
 * @returns {Promise<boolean>} whether the mail was accepted
 */
async function deliverOtpEmail(email, code, purpose) {
  try {
    await sendOtpEmail(email, code, purpose);
    return true;
  } catch (err) {
    // Logged, not thrown
    console.error(`[auth] OTP email failed (${purpose}) for ${email}:`, err.message);
    return false;
  }
}

// A double-submitted or concurrent request shares one issue + send. A second code
// would invalidate the first, and its email lands as a duplicate. In memory: resets on restart
const OTP_DEDUPE_MS = 10 * 1000;
const recentOtpSends = new Map();

/**
 * Issues a fresh code and emails it, once per user and purpose within OTP_DEDUPE_MS
 *
 * @returns {Promise<boolean>} same as sendOtpWithinWait
 */
function issueAndSendOtp(userId, email, purpose) {
  const key = `${purpose}:${userId}`;
  const inFlight = recentOtpSends.get(key);
  if (inFlight) return inFlight;

  const sent = withTransaction((client) => issueOtpChallenge(userId, purpose, client)).then((code) =>
    sendOtpWithinWait(email, code, purpose),
  );
  recentOtpSends.set(key, sent);
  // A failed send is released at once, so the retry isn't blocked
  const release = () => recentOtpSends.delete(key);
  sent.then((ok) => (ok ? setTimeout(release, OTP_DEDUPE_MS).unref() : release()), release);
  return sent;
}

// otp for email verification and password reset. Every failure throws the
// same INVALID_CODE_MESSAGE -- see its comment
async function consumeOtpChallenge({ userId, purpose, code }) {
  const challenge = await AuthChallenge.findLatestActive(userId, purpose);
  if (!AuthChallenge.isUsable(challenge)) {
    throw ApiError.badRequest(INVALID_CODE_MESSAGE, { code: 'INVALID_CODE' });
  }

  const isValid = await verifyOtp(code, challenge.codeHash);
  if (!isValid) {
    await AuthChallenge.incrementFailedAttempts(challenge.id);
    throw ApiError.badRequest(INVALID_CODE_MESSAGE, { code: 'INVALID_CODE' });
  }

  // Conditional on still being unconsumed, so of two concurrent correct
  // submissions only one gets through
  const consumed = await AuthChallenge.markConsumed(challenge.id);
  if (!consumed) {
    throw ApiError.badRequest(INVALID_CODE_MESSAGE, { code: 'INVALID_CODE' });
  }
  return challenge;
}

module.exports = {
  issueOtpChallenge,
  emailFailed,
  sendOtpWithinWait,
  issueAndSendOtp,
  consumeOtpChallenge,
};