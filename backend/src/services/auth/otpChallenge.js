const { withTransaction } = require('../../../config/mongo');
const AuthChallenge = require('../../models/auth/AuthChallenge');
const { generateOtp, hashOtp, verifyOtp, otpExpiryDate } = require('../../utils/auth/otp');
const { ApiError } = require('../../utils/httpResponse');
const { sendOtpEmail } = require('../mailer');
const { INVALID_CODE_MESSAGE, EMAIL_FAILED_MESSAGE, MIN_RESPONSE_MS } = require('./authResponses');

// Invalidates any active challenge for this purpose and issues a new one
async function issueOtpChallenge(userId, purpose, client) {
  await AuthChallenge.invalidateActive(userId, purpose, client);
  const code = generateOtp();
  const codeHash = await hashOtp(code);
  await AuthChallenge.issue({ userId, purpose, codeHash, expiresAt: otpExpiryDate() }, client);
  return code;
}

const emailFailed = () => new ApiError(503, EMAIL_FAILED_MESSAGE, { code: 'EMAIL_SEND_FAILED' });

/**
 * Waits up to MIN_RESPONSE_MS for email acceptance so response timing matches unknown-email paths.
 *
 * @returns {Promise<boolean>} false only when the send failed within the wait window
 */
async function sendOtpWithinWait(email, code, purpose) {
  const sent = deliverOtpEmail(email, code, purpose);
  const stillPending = new Promise((resolve) => setTimeout(resolve, MIN_RESPONSE_MS, true));
  return Promise.race([sent, stillPending]);
}

/**
 * Sends the OTP email outside the DB transaction without throwing on failure.
 *
 * @returns {Promise<boolean>}
 */
async function deliverOtpEmail(email, code, purpose) {
  try {
    await sendOtpEmail(email, code, purpose);
    return true;
  } catch (err) {
    console.error(`[auth] OTP email failed (${purpose}) for ${email}:`, err.message);
    return false;
  }
}

// In-memory deduplication window for concurrent OTP requests
const OTP_DEDUPE_MS = 10 * 1000;
const recentOtpSends = new Map();

/**
 * Issues and emails a fresh OTP code, deduplicating per user and purpose within OTP_DEDUPE_MS.
 *
 * @returns {Promise<boolean>}
 */
function issueAndSendOtp(userId, email, purpose) {
  const key = `${purpose}:${userId}`;
  const inFlight = recentOtpSends.get(key);
  if (inFlight) return inFlight;

  const sent = withTransaction((client) => issueOtpChallenge(userId, purpose, client)).then((code) =>
    sendOtpWithinWait(email, code, purpose),
  );
  recentOtpSends.set(key, sent);
  const release = () => recentOtpSends.delete(key);
  sent.then((ok) => (ok ? setTimeout(release, OTP_DEDUPE_MS).unref() : release()), release);
  return sent;
}

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

  // Atomically mark consumed so concurrent submissions cannot both succeed
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
