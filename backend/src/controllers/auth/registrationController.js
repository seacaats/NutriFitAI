const { withTransaction } = require('../../../config/mongo');
const User = require('../../models/user/User');
const WeightLog = require('../../models/user/WeightLog');
const { hashPassword } = require('../../utils/auth/password');
const { normalizeGoal } = require('../../utils/goals/goalNormalizer');
const { sendSuccess, ApiError, asyncHandler } = require('../../utils/httpResponse');
const { logAction } = require('../../utils/audit-logs/auditLogger');
const { sendRegistrationNoticeEmail } = require('../../services/mailer');
const { INVALID_CODE_MESSAGE, REGISTER_ACCEPTED_MESSAGE, padResponse } = require('../../services/auth/authResponses');
const {
  issueOtpChallenge, sendOtpWithinWait, emailFailed, issueAndSendOtp, consumeOtpChallenge,
} = require('../../services/auth/otpChallenge');
const env = require('../../../config/env');

// One "someone tried to register" email per address per hour, so the form
// can't be used to flood a stranger's inbox. In memory: resets on restart
const NOTICE_COOLDOWN_MS = 60 * 60 * 1000;
const lastNoticeAt = new Map();

function sendRegistrationNotice(email, opts) {
  const last = lastNoticeAt.get(email);
  if (last && Date.now() - last < NOTICE_COOLDOWN_MS) return;
  if (lastNoticeAt.size > 10000) lastNoticeAt.clear();
  lastNoticeAt.set(email, Date.now());

  sendRegistrationNoticeEmail(email, opts).catch((err) => {
    console.error(`[auth] registration notice failed for ${email}:`, err.message);
  });
}

// Writes the submitted profile fields. Used for new accounts and to overwrite
// a still-unverified one, so unset optionals become null rather than lingering
function registrationProfile({ age, sex, heightCm, activityLevel, dietPreference, healthConditions }) {
  return {
    age: age ?? null,
    sex: sex ?? null,
    heightCm,
    activityLevel: activityLevel ?? null,
    dietPreference: dietPreference ?? null,
    healthConditions: healthConditions ?? null,
  };
}

function registerAcceptedResponse(res, email) {
  return sendSuccess(res, {
    statusCode: 201,
    message: REGISTER_ACCEPTED_MESSAGE,
    data: { email, emailVerified: false },
  });
}

/**
 * POST /api/auth/register
 *
 * Responds identically in all three cases, so the endpoint can't be used to
 * probe which emails are registered:
 *  - new email: account created, code sent
 *  - existing but unverified: the pending account is overwritten with this
 *    submission and a fresh code is sent. Issuing it invalidates every earlier
 *    code, so only the latest email's code works
 *  - existing and verified: nothing is written; the owner gets a "someone
 *    tried to register" email instead of a code
 *
 * Unverified accounts hold their sign-up weight in pendingWeightKg and are
 * deleted by the users TTL index after env.unverifiedTtlHours
 */
const register = asyncHandler(async (req, res) => {
  const {
    firstName, lastName, email, password, weightKg, goal,
    dietPreference, healthConditions,
  } = req.body;

  const startedAt = Date.now();
  const normalizedEmail = email.toLowerCase();

  // Hashed up front on every path, so the verified-account branch (which
  // otherwise does almost nothing) takes as long as the others
  const passwordHash = await hashPassword(password);

  const existing = await User.findByEmail(normalizedEmail);
  if (existing && existing.emailVerifiedAt) {
    sendRegistrationNotice(normalizedEmail);
    await padResponse(startedAt);
    return registerAcceptedResponse(res, normalizedEmail);
  }

  const pending = {
    unverifiedExpiresAt: new Date(Date.now() + env.unverifiedTtlHours * 60 * 60 * 1000),
    pendingWeightKg: weightKg,
  };

  const names = {
    firstName,
    lastName: lastName || null,
    fullName: [firstName, lastName].filter(Boolean).join(' ') || null,
  };
  // Timezone from the X-Timezone header, so the first goal's date is the user's day
  const profile = { ...registrationProfile(req.body), timezone: req.timeZone ?? null };
  const normalizedGoal = normalizeGoal(goal);

  const { userId, otpCode } = await withTransaction(async (client) => {
    let id;
    if (existing) {
      // Unverified, so nothing here was ever proven to belong to the email's
      // owner -- the latest submission replaces it
      id = existing.id;
      await User.updateNames(id, names, client);
      await User.updatePasswordHash(id, passwordHash, client);
      await User.updateProfile(id, profile, client);
      await User.setActiveGoal({ userId: id, fitnessGoal: normalizedGoal }, client);
      await User.updatePendingRegistration(id, pending, client);
    } else {
      const created = await User.createAccount(
        { email: normalizedEmail, passwordHash, ...names, termsAcceptedAt: new Date(), ...pending },
        client,
      );
      id = created.id;
      await User.updateProfile(id, profile, client);
      await User.addInitialGoal({ userId: id, fitnessGoal: normalizedGoal }, client);
    }

    // No weight log yet: it's written from pendingWeightKg on verification,
    // so re-registering never piles up weights for an unproven account
    const code = await issueOtpChallenge(id, 'email_verification', client);
    return { userId: id, otpCode: code };
  });

  // Record user accepting consent at registration,
  // alongside other associated details
  await logAction(
    req,
    {
      action: 'auth.register.consent_accepted',
      targetType: 'user',
      details: {
        termsAccepted: true,
        reRegistration: Boolean(existing),
        providedDietPreference: Boolean(dietPreference),
        providedHealthConditions: Boolean(healthConditions),
      },
    },
    { userId, role: 'user' },
  );

  // A re-registration replaces an unverified account, it doesn't create one
  if (!existing) {
    await logAction(req, { action: 'auth.register.completed', targetType: 'user' }, { userId, role: 'user' });
  }

  // Outside the transaction and non-fatal. Waits for the send only up to
  // MIN_RESPONSE_MS, so a failed send is reported and a slow one isn't
  // distinguishable by timing
  const emailSent = await sendOtpWithinWait(normalizedEmail, otpCode, 'email_verification');

  await padResponse(startedAt);
  if (!emailSent) throw emailFailed();
  return registerAcceptedResponse(res, normalizedEmail);
});

// verify registration
const verifyRegistration = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  const user = await User.findByEmail(email);
  // Unknown and already-verified emails fail exactly like a wrong code
  if (!user || user.emailVerifiedAt) {
    throw ApiError.badRequest(INVALID_CODE_MESSAGE, { code: 'INVALID_CODE' });
  }

  await consumeOtpChallenge({ userId: user.id, purpose: 'email_verification', code });

  // Verify and write the held sign-up weight together, so a verified account
  // always has its first weight log
  await withTransaction(async (client) => {
    const before = await User.markEmailVerified(user.id, client);
    if (before?.pendingWeightKg) {
      await WeightLog.record({ userId: user.id, weightKg: before.pendingWeightKg }, client);
    }
  });

  await logAction(req, { action: 'auth.email.verified', targetType: 'user' }, { userId: user.id, role: user.role });

  return sendSuccess(res, {
    message: 'Email verified successfully',
    data: { userId: user.id, email: user.email, emailVerified: true },
  });
});

// resend registration otp
const resendRegistrationOtp = asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  const { email } = req.body;

  const user = await User.findByEmail(email);
  // Always respond generically (and after the same minimum time) to avoid account enumeration
  const genericResponse = async () => {
    await padResponse(startedAt);
    return sendSuccess(res, { message: 'If an account exists for this email, a new code has been sent.' });
  };

  if (!user || user.emailVerifiedAt) {
    return genericResponse();
  }

  // Challenge committed first, then emailed, once per double-submit
  const emailSent = await issueAndSendOtp(user.id, user.email, 'email_verification');

  await logAction(req, { action: 'auth.otp.resent', targetType: 'user' }, { userId: user.id, role: user.role });

  // Unknown and verified emails returned above, so only a real failed send ends up here
  if (!emailSent) {
    await padResponse(startedAt);
    throw emailFailed();
  }
  return genericResponse();
});

module.exports = { register, verifyRegistration, resendRegistrationOtp, sendRegistrationNotice };