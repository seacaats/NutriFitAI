const { withTransaction } = require('../../config/mongo');
const User = require('../models/user/User');
const WeightLog = require('../models/user/WeightLog');
const AuthChallenge = require('../models/auth/AuthChallenge');
const AuthIdentity = require('../models/auth/AuthIdentity');

const { hashPassword, verifyPassword } = require('../utils/auth/password');
const { generateOtp, hashOtp, verifyOtp, otpExpiryDate } = require('../utils/auth/otp');
const { signAccessToken, signRefreshToken, refreshSessionRemainingMs, refreshCookieMaxAgeMs,
        verifyRefreshToken, signResetToken, verifyResetToken,
        signOauthExchangeToken, verifyOauthExchangeToken } = require('../utils/auth/token');
const { REFRESH_COOKIE_NAME, refreshCookieOptions, clearRefreshCookie, setRefreshCookie } = require('../utils/auth/refreshCookie');
const crypto = require('crypto');
const { normalizeGoal } = require('../utils/goalNormalizer');
const { isAllowedRedirectUri } = require('../utils/auth/redirectUri');
const { saveRemoteAvatar, isUserUploaded, toPublicAvatarUrl } = require('../utils/storage/avatarStore');
const { sendSuccess, ApiError, asyncHandler } = require('../utils/httpResponse');
const { logAction } = require('../utils/audit-logs/auditLogger');
const { notify } = require('../services/notifications/notify');
const { buildAuthUrl, exchangeCodeForProfile } = require('../services/googleOAuth');
const { sendOtpEmail, sendRegistrationNoticeEmail } = require('../services/mailer');
const env = require('../../config/env');

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

// One "someone tried to register" email per address per hour, so the form
// can't be used to flood a stranger's inbox. In memory: resets on restart
const NOTICE_COOLDOWN_MS = 60 * 60 * 1000;
const lastNoticeAt = new Map();

function sendRegistrationNotice(email) {
  const last = lastNoticeAt.get(email);
  if (last && Date.now() - last < NOTICE_COOLDOWN_MS) return;
  if (lastNoticeAt.size > 10000) lastNoticeAt.clear();
  lastNoticeAt.set(email, Date.now());

  sendRegistrationNoticeEmail(email).catch((err) => {
    console.error(`[auth] registration notice failed for ${email}:`, err.message);
  });
}

// bcrypt hash of a throwaway value, compared against when the email is unknown
// so a miss costs the same ~bcrypt time as a hit. Computed once, lazily
let dummyHashPromise = null;
function dummyHash() {
  if (!dummyHashPromise) dummyHashPromise = hashPassword(crypto.randomUUID());
  return dummyHashPromise;
}

// Invalidate/Overwrite active challenge for this purpose, issuing a new one
async function issueOtpChallenge(userId, purpose, client) {
  await AuthChallenge.invalidateActive(userId, purpose, client);
  const code = generateOtp();
  const codeHash = await hashOtp(code);
  await AuthChallenge.issue({ userId, purpose, codeHash, expiresAt: otpExpiryDate() }, client);
  return code;
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

  // Commit challenge first, and then send the email to avoid
  // doubling up the transaction whenever it retries
  const code = await withTransaction((client) =>
    issueOtpChallenge(user.id, 'email_verification', client),
  );

  const emailSent = await sendOtpWithinWait(user.email, code, 'email_verification');

  await logAction(req, { action: 'auth.otp.resent', targetType: 'user' }, { userId: user.id, role: user.role });

  // Unknown and verified emails returned above, so only a real failed send ends up here
  if (!emailSent) {
    await padResponse(startedAt);
    throw emailFailed();
  }
  return genericResponse();
});

// api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const user = await User.findByEmail(email);

  // Always runs bcrypt (against a dummy hash for unknown emails) so response
  // time doesn't reveal whether the account exists
  const passwordOk = await verifyPassword(password, user?.passwordHash || (await dummyHash()));

  // Unknown email, unverified account and wrong password all look the same.
  // An unverified user recovers by registering again, which resends a code
  if (!user || !passwordOk || !user.emailVerifiedAt) {
    // No actor: the request isn't authenticated. The account, when there is
    // one, is the target. The email itself is only ever stored hashed
    let reason = 'unverified';
    if (!user) reason = 'unknown_email';
    else if (!passwordOk) reason = 'wrong_password';
    await logAction(
      req,
      {
        action: 'auth.login.failed',
        targetType: 'user',
        targetId: user?.id ?? null,
        targetRole: user?.role ?? null,
        details: { reason },
        hash: { emailHash: String(email).toLowerCase() },
      },
      { userId: null, role: null },
    );
    throw ApiError.unauthorized(INVALID_LOGIN_MESSAGE, { code: 'INVALID_CREDENTIALS' });
  }

  const hold = accountHold(user);
  if (hold) {
    await logAction(
      req,
      { action: 'auth.login.failed', targetType: 'user', targetId: user.id, targetRole: user.role, details: { reason: hold.reason } },
      { userId: null, role: null },
    );
    throw hold.error;
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, rememberMe);
  setRefreshCookie(res, refreshToken, rememberMe, req);

  await logAction(
    req,
    { action: 'auth.login.succeeded', targetType: 'user', details: { method: 'password', rememberMe: Boolean(rememberMe) } },
    { userId: user.id, role: user.role },
  );

  return sendSuccess(res, {
    message: 'Login successful',
    data: {
      accessToken,
      user: User.toAuthPayload(user),
    },
  });
});

// api/auth/google — kicks off the flow
const googleAuthStart = asyncHandler(async (req, res) => {
  const { redirectUri, popup } = req.query;

  // Precise matches against APP_REDIRECT_URIS rejects every native deep
  // link, because Expo Go URL contains a LAN address or a per-run tunnel
  // host. isAllowedRedirectUri() handles those without loosening the rule for
  // https redirects (lib/auth/redirectUri.js)
  if (!(await isAllowedRedirectUri(redirectUri))) {
    throw ApiError.badRequest('Invalid or missing redirectUri');
  }

  // "popup" is carried through an encoded state parameter
  // as it's the only reliable way to detect it. Courtesy of Google's
  // login page breaking connections to the main window
  const state = Buffer.from(
    JSON.stringify({ redirectUri, popup: popup === '1', nonce: crypto.randomUUID() }),
  ).toString('base64url');
  const url = buildAuthUrl(state);
  return res.redirect(url);
});

// api/auth/google/callback
const googleAuthCallback = asyncHandler(async (req, res) => {
  const { code, state, error: googleError } = req.query;

  let redirectUri;
  let popup;
  try {
    ({ redirectUri, popup } = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')));
    if (!(await isAllowedRedirectUri(redirectUri))) throw new Error('redirect not allowlisted');
  } catch {
    throw ApiError.badRequest('Invalid OAuth state');
  }

  const popupParam = popup ? '1' : '0';

  if (googleError || !code) {
    return res.redirect(`${redirectUri}?error=google_auth_failed&popup=${popupParam}`);
  }

  const profile = await exchangeCodeForProfile(code);
  if (!profile.emailVerified) {
    return res.redirect(`${redirectUri}?error=google_email_unverified&popup=${popupParam}`);
  }

  // Google sign-in only authenticates verified, registered accounts. Anything
  // else -- no account, or one that never finished email verification -- is
  // sent to registration with ONE error code, so the redirect can't be used to
  // tell those two apart. Registering again with an unverified email just
  // re-sends its code (see register)
  const registrationRequired = () => res.redirect(
    `${redirectUri}?error=registration_required`
      + `&email=${encodeURIComponent(profile.email)}&popup=${popupParam}`,
  );

  let user = await User.findByProviderIdentity('google', profile.googleId);

  if (user && !user.emailVerifiedAt) {
    return registrationRequired();
  }

  if (user) {
    // Already linked. Refresh the avatar so a changed Google photo is picked up
    if (profile.avatarUrl) {
      // Never overwrite a photo the user uploaded themselves
      const current = await User.getProfile(user.id);
      if (!isUserUploaded(current?.avatarStorageKey)) {
        const stored = await saveRemoteAvatar(user.id, profile.avatarUrl);
        if (stored) {
          await User.updateAvatar(user.id, stored);
        }
      }
    }
  } else {
    const existing = await User.findByEmail(profile.email);
    if (!existing || !existing.emailVerifiedAt) {
      return registrationRequired();
    }

    // Verified account, first Google sign-in: link it.
    // Avatar downloaded before the transaction
    const storedAvatar = profile.avatarUrl ? await saveRemoteAvatar(existing.id, profile.avatarUrl) : null;

    user = await withTransaction(async (client) => {
      await AuthIdentity.link(
        { userId: existing.id, provider: 'google', providerSubject: profile.googleId },
        client,
      );
      if (storedAvatar) {
        await User.updateAvatar(existing.id, storedAvatar, client);
      }
      return User.getById(existing.id, client);
    });

    await logAction(
      req,
      { action: 'auth.oauth.linked', targetType: 'user', details: { provider: 'google' } },
      { userId: user.id, role: user.role },
    );
    notify(user.id, 'google_linked');
  }

  const exchangeToken = signOauthExchangeToken({ userId: user.id });
  return res.redirect(`${redirectUri}?exchangeToken=${exchangeToken}&popup=${popupParam}`);
});

// api/auth/google/exchange
const googleExchange = asyncHandler(async (req, res) => {
  const { exchangeToken } = req.body;

  let payload;
  try {
    payload = verifyOauthExchangeToken(exchangeToken);
    if (payload.type !== 'oauth_exchange') throw new Error('wrong token type');
  } catch {
    throw ApiError.unauthorized('Invalid or expired sign-in session. Please try again.');
  }

  const user = await User.getById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('Invalid or expired sign-in session. Please try again.');
  }

  const hold = accountHold(user);
  if (hold) {
    await logAction(
      req,
      { action: 'auth.login.failed', targetType: 'user', targetId: user.id, targetRole: user.role, details: { reason: hold.reason } },
      { userId: null, role: null },
    );
    throw hold.error;
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, true);
  setRefreshCookie(res, refreshToken, true, req);

  await logAction(
    req,
    { action: 'auth.login.succeeded', targetType: 'user', details: { method: 'google', rememberMe: true } },
    { userId: user.id, role: user.role },
  );

  return sendSuccess(res, {
    message: 'Login successful',
    data: {
      accessToken,
      user: User.toAuthPayload(user),
    },
  });
});

// api/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const startedAt = Date.now();
  const { email } = req.body;
  const user = await User.findByEmail(email);

  let emailSent = true;
  if (user) {
    const code = await withTransaction((client) =>
      issueOtpChallenge(user.id, 'password_reset', client),
    );
    emailSent = await sendOtpWithinWait(user.email, code, 'password_reset');
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

// api/auth/verify-password-reset
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

// api/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, password } = req.body;

  let payload;
  try {
    payload = verifyResetToken(resetToken);
    if (payload.type !== 'password_reset') throw new Error('wrong token type');
  } catch {
    throw ApiError.unauthorized('Invalid or expired reset authorization. Please restart password reset.');
  }

  const challenge = await AuthChallenge.getById(payload.cid);
  if (!challenge || !challenge.consumedAt || challenge.userId !== payload.sub) {
    throw ApiError.unauthorized('Invalid or expired reset authorization. Please restart password reset.');
  }

  const user = await User.getById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('Invalid or expired reset authorization. Please restart password reset.');
  }

  // The token stays valid, so the user can simply pick another password
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


// api/auth/refresh

// rmb = rememberMe (Seven day window)
// sxp = absolute session deadline (Thirty day window, absolute max)
// No revocation as these are stateless JWTs, meaning stolen cookies
// can still remain valid until sxp
// Implement JWT ID eventually
function rejectRefresh(req, targetId, reason) {
  return logAction(
    req,
    { action: 'auth.token.refresh_rejected', targetType: 'user', targetId, details: { reason } },
    { userId: null, role: null },
  );
}

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies[REFRESH_COOKIE_NAME];
  if (!token) {
    throw ApiError.unauthorized('No refresh session found. Please log in again.');
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
    if (payload.type !== 'refresh') throw new Error('wrong token type');
  } catch (err) {
    // Clears refresh cookies on any validation failure
    clearRefreshCookie(res, req);
    // Unverified token, so its subject can't be trusted -- recorded without one
    await rejectRefresh(req, null, err.name === 'TokenExpiredError' ? 'expired' : 'invalid');
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }

  const user = await User.getById(payload.sub);
  if (!user) {
    clearRefreshCookie(res, req);
    await rejectRefresh(req, payload.sub, 'account_missing');
    throw ApiError.unauthorized('This account no longer exists.');
  }

  // Ends existing sessions within one access-token lifetime of the hold
  const hold = accountHold(user);
  if (hold) {
    clearRefreshCookie(res, req);
    await rejectRefresh(req, user.id, hold.reason);
    throw hold.error;
  }

  const accessToken = signAccessToken(user);


  // Check for sxp, regardless of refresh/replacement cookie
  const remainingMs = refreshSessionRemainingMs(payload);
  if (remainingMs <= 0) {
    clearRefreshCookie(res, req);
    await rejectRefresh(req, user.id, 'session_ceiling');
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }

  const rotated = signRefreshToken(user, Boolean(payload.rmb), payload.sxp || Date.now() + remainingMs);
  // Same options helper as login -- maxAge is min(idle 
  // window, remaining ceiling), see refreshCookieMaxAgeMs
  res.cookie(REFRESH_COOKIE_NAME, rotated, refreshCookieOptions(req, refreshCookieMaxAgeMs(payload)));

  return sendSuccess(res, {
    message: 'Session refreshed',
    data: {
      accessToken,
      user: User.toAuthPayload(user),
    },
  });
});

// api/auth/logout
const logout = asyncHandler(async (req, res) => {
  // Unauthenticated route, so the actor comes from the refresh cookie. No
  // valid cookie means there was no session to end, and nothing is recorded
  let sub = null;
  try {
    const payload = verifyRefreshToken(req.cookies[REFRESH_COOKIE_NAME]);
    if (payload.type === 'refresh') sub = payload.sub;
  } catch {
    sub = null;
  }
  if (sub) {
    await logAction(req, { action: 'auth.logout', targetType: 'user' }, { userId: sub });
  }

  clearRefreshCookie(res, req);
  return sendSuccess(res, { message: 'Logged out' });
});

// api/auth/me
const me = asyncHandler(async (req, res) => {
  const user = await User.getById(req.userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const profile = await User.getProfile(req.userId);
  const goal = await User.getActiveGoal(req.userId);
  const latestWeight = await WeightLog.findLatestByUserId(req.userId);

  return sendSuccess(res, {
    data: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: Boolean(user.emailVerifiedAt),
      role: user.role || 'user',
      createdAt: user.createdAt,
      age: profile?.age ?? null,
      heightCm: profile?.heightCm ?? null,
      sex: profile?.sex ?? null,
      activityLevel: profile?.activityLevel ?? null,
      dietPreference: profile?.dietPreference ?? null,
      healthConditions: profile?.healthConditions ?? null,
      notificationsEnabled: profile?.notificationsEnabled ?? true,
      // The account's theme, which the app applies on login
      theme: profile?.theme ?? 'system',
      avatarUrl: await toPublicAvatarUrl(profile?.avatarStorageKey),
      weightKg: latestWeight?.weightKg ?? null,
      fitnessGoal: goal?.fitnessGoal ?? null,
      // Setup wizard: shown until onboarded, then a banner while it's all empty
      onboarded: Boolean(profile?.onboardedAt),
      setupPending: User.isSetupPending(profile, goal),
    },
  });
});

module.exports = {
  register,
  verifyRegistration,
  resendRegistrationOtp,
  login,
  googleAuthStart,
  googleAuthCallback,
  googleExchange,
  forgotPassword,
  verifyPasswordReset,
  resetPassword,
  refresh,
  logout,
  me,
};