const { withTransaction } = require('../../config/mongo');
const User = require('../models/user/User');
const UserProfile = require('../models/user/UserProfile');
const UserGoal = require('../models/user/UserGoal');
const WeightLog = require('../models/user/WeightLog');
const AuthChallenge = require('../models/auth/AuthChallenge');
const AuthIdentity = require('../models/auth/AuthIdentity');

const { hashPassword, verifyPassword } = require('../utils/auth/password');
const { generateOtp, hashOtp, verifyOtp, otpExpiryDate } = require('../utils/auth/otp');
const { signAccessToken, signRefreshToken, refreshSessionRemainingMs, refreshCookieMaxAgeMs,
        refreshTokenMaxAgeMs, verifyRefreshToken, signResetToken, verifyResetToken,
        signOauthExchangeToken, verifyOauthExchangeToken } = require('../utils/auth/token');
const crypto = require('crypto');
const { normalizeGoal } = require('../utils/goalNormalizer');
const { isAllowedRedirectUri } = require('../utils/auth/redirectUri');
const { saveRemoteAvatar, isUserUploaded, toPublicAvatarUrl } = require('../utils/avatarStore');
const { sendSuccess, ApiError, asyncHandler } = require('../utils/httpResponse');
const { logAction } = require('../utils/auditLogger');
const { buildAuthUrl, exchangeCodeForProfile } = require('../services/googleOAuth');
const { sendOtpEmail } = require('../services/mailer');
const env = require('../../config/env');

const REFRESH_COOKIE_NAME = 'nf_refresh';

function toAuthUserPayload(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    emailVerified: Boolean(user.emailVerifiedAt),
    role: user.role || 'user',
  };
}

// Invalidate/Overwrite active challenge for this purpose, issuing a new one
async function issueOtpChallenge(userId, purpose, client) {
  await AuthChallenge.invalidateActive(userId, purpose, client);
  const code = generateOtp();
  const codeHash = await hashOtp(code);
  await AuthChallenge.create({ userId, purpose, codeHash, expiresAt: otpExpiryDate() }, client);
  return code;
}

// Check per request if it came in secure or not, and returns
// the proper cookie that's correct. No secure cookies on http,
// only returning to users that access ON https
function isRequestSecure(req) {
  if (env.nodeEnv === 'production') return true;
  const forwarded = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return forwarded === 'https' || req.secure === true || req.protocol === 'https';
}

// Centralized cookie settings for login, OAuth, and token-refresh
function refreshCookieOptions(req, maxAge) {
  const https = isRequestSecure(req);
  return {
    httpOnly: true,
    // SameSite=None can only work with Secure, so both toggled together
    secure: https,
    sameSite: https ? 'none' : 'lax',
    // Omit Domain, letting the browser handle it automatically,
    // across local/network/tunnel access
    ...(env.cookie.domain ? { domain: env.cookie.domain } : {}),
    maxAge,
    path: '/api/auth',
  };
}

// Cookie deletion must match cookie's original settings/configuration,
// else the browser keeps the supposedly dead cookie indefinitely
function clearRefreshCookie(res, req) {
  const { maxAge, ...options } = refreshCookieOptions(req, 0);
  res.clearCookie(REFRESH_COOKIE_NAME, options);
}

function setRefreshCookie(res, token, rememberMe, req) {
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions(req, refreshTokenMaxAgeMs(rememberMe)));
}

// register new users
const register = asyncHandler(async (req, res) => {
  const {
    firstName: firstNameInput, lastName: lastNameInput, fullName: fullNameInput,
    email, password, age, heightCm, weightKg, gender, goal,
    activityLevel, dietPreference, healthConditions,
  } = req.body;

  const alreadyExists = await User.existsByEmail(email);
  if (alreadyExists) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const passwordHash = await hashPassword(password);

  const firstName = firstNameInput;
  const lastName = lastNameInput || null;
  const fullName = fullNameInput || null;

  const normalizedGoal = normalizeGoal(goal);

  const { user, otpCode } = await withTransaction(async (client) => {
    const createdUser = await User.create(
      { email, passwordHash, fullName, firstName, lastName, termsAcceptedAt: new Date() },
      client,
    );

    await UserProfile.create(
      { userId: createdUser.id, age, gender, heightCm, activityLevel, dietPreference, healthConditions },
      client,
    );
    await UserGoal.createInitial({ userId: createdUser.id, fitnessGoal: normalizedGoal }, client);

    if (weightKg) {
      await WeightLog.create({ userId: createdUser.id, weightKg }, client);
    }

    const code = await issueOtpChallenge(createdUser.id, 'email_verification', client);

    return { user: createdUser, otpCode: code };
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
        providedDietPreference: Boolean(dietPreference),
        providedHealthConditions: Boolean(healthConditions),
      },
    },
    { userId: user.id, role: 'user' },
  );

  // Outside the transaction, and non-fatal
  const delivered = await deliverOtpEmail(user.email, otpCode, 'email_verification');

  return sendSuccess(res, {
    statusCode: 201,
    message: delivered 
      ? 'Registration successful. Check your email for a verification code.'
      : 'Account created, but the verification email could not be sent. Use "Resend code" to try again.',
    data: {
      userId: user.id,
      email: user.email,
      emailVerified: false,
      // Lets the client surface the resend button immediately rather than
      // leaving the user waiting for a code that was never sent
      codeSent: delivered,
    },
  });
});

/**
 * Never throws as the underlying database action already
 * succeeded and can't easily be undone
 * 
 * Called outside the transaction to avoid resending the email
 * again and again which simply leads to spam and duplicate OTPsh
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

// otp for email verification and password reset 
async function consumeOtpChallenge({ userId, purpose, code }) {
  const challenge = await AuthChallenge.findLatestActive(userId, purpose);
  if (!challenge) {
    throw ApiError.badRequest('No active verification code found. Please request a new one.');
  }

  if (new Date(challenge.expiresAt).getTime() < Date.now()) {
    throw ApiError.badRequest('This code has expired. Please request a new one.');
  }

  if (challenge.failedAttempts >= env.otp.maxFailedAttempts) {
    throw ApiError.tooManyRequests('Too many incorrect attempts. Please request a new code.');
  }

  const isValid = await verifyOtp(code, challenge.codeHash);
  if (!isValid) {
    await AuthChallenge.incrementFailedAttempts(challenge.id);
    throw ApiError.badRequest('Incorrect verification code');
  }

  await AuthChallenge.markConsumed(challenge.id);
  return challenge;
}

// verify registration
const verifyRegistration = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  const user = await User.findByEmail(email);
  if (!user) {
    throw ApiError.badRequest('Invalid email or code');
  }
  if (user.emailVerifiedAt) {
    return sendSuccess(res, { message: 'Email already verified', data: { emailVerified: true } });
  }

  await consumeOtpChallenge({ userId: user.id, purpose: 'email_verification', code });
  const updated = await User.markEmailVerified(user.id);

  return sendSuccess(res, {
    message: 'Email verified successfully',
    data: { userId: updated.id, email: updated.email, emailVerified: true },
  });
});

// resend registration otp
const resendRegistrationOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findByEmail(email);
  // Always respond generically to avoid account enumeration
  const genericResponse = () =>
    sendSuccess(res, { message: 'If an account exists for this email, a new code has been sent.' });

  if (!user || user.emailVerifiedAt) {
    return genericResponse();
  }

  // Commit challenge first, and then send the email to avoid
  // doubling up the transaction whenever it retries
  const code = await withTransaction((client) =>
    issueOtpChallenge(user.id, 'email_verification', client),
  );

  await deliverOtpEmail(user.email, code, 'email_verification');

  // The response is identical whether or not the mail 
  // succeeded, and whether or not the account exists.
  return genericResponse();
});

// api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const user = await User.findByEmail(email);

  // Confirms that accounts aren't recorded, should change
  if (!user) {
    throw ApiError.unauthorized(
      "Your account isn't recorded in our database. Please register first.",
      { code: 'ACCOUNT_NOT_FOUND' },
    );
  }

  // Supposedly checks accounts made with only Google OAuth, ignore it
  // if (!user.passwordHash) {
  //   throw ApiError.unauthorized(
  //     'This account signs in with Google. Use "Continue with Google", or set a password '
  //       + 'with "Forgot password".',
  //     { code: 'NO_PASSWORD_SET' },
  //   );
  // }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (!user.emailVerifiedAt) {
    throw ApiError.forbidden('Please verify your email before logging in', { code: 'EMAIL_NOT_VERIFIED' });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, rememberMe);
  setRefreshCookie(res, refreshToken, rememberMe, req);

  return sendSuccess(res, {
    message: 'Login successful',
    data: {
      accessToken,
      user: toAuthUserPayload(user),
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

  let user = await User.findByProviderIdentity('google', profile.googleId);


  // Recheck email verification even for linked Google accounts
  if (user && !user.emailVerifiedAt) {
    return res.redirect(
      `${redirectUri}?error=email_not_verified`
        + `&email=${encodeURIComponent(user.email)}&popup=${popupParam}`,
    );
  }

  if (user) {
    // Already linked. Refresh the avatar so a changed Google photo is picked up 
    if (profile.avatarUrl) {
      // Never overwrite a photo the user uploaded themselves
      const current = await UserProfile.findByUserId(user.id);
      if (!isUserUploaded(current?.avatarStorageKey)) {
        const stored = await saveRemoteAvatar(user.id, profile.avatarUrl);
        if (stored) {
          await UserProfile.updateAvatar(user.id, stored);
        }
      }
    }
  }

  if (!user) {
    const existing = await User.findByEmail(profile.email);

    // Block Google sign-in for existing but unverified accounts
    if (existing && !existing.emailVerifiedAt) {
      return res.redirect(
        `${redirectUri}?error=email_not_verified`
          + `&email=${encodeURIComponent(existing.email)}&popup=${popupParam}`,
      );
    }

    if (existing) {
      // Downloaded before transaction
      const storedAvatar = profile.avatarUrl ? await saveRemoteAvatar(existing.id, profile.avatarUrl) : null;

      user = await withTransaction(async (client) => {
        await AuthIdentity.link(
          { userId: existing.id, provider: 'google', providerSubject: profile.googleId },
          client,
        );
        if (storedAvatar) {
          await UserProfile.updateAvatar(existing.id, storedAvatar, client);
        }
        // Additional defensive check, if it ever does triggere
        if (!existing.emailVerifiedAt) {
          throw new Error('unverified account reached the OAuth link branch');
        }
        return User.findById(existing.id, client);
      });
    } else {
      // Google OAuth only authenticates recorded users
      return res.redirect(`${redirectUri}?error=account_not_found&popup=${popupParam}`);
    }
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

  const user = await User.findById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('Invalid or expired sign-in session. Please try again.');
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, true);
  setRefreshCookie(res, refreshToken, true, req);

  return sendSuccess(res, {
    message: 'Login successful',
    data: {
      accessToken,
      user: toAuthUserPayload(user),
    },
  });
});

// api/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findByEmail(email);

  // Replace with sending an email anyway
  if (!user) {
    throw ApiError.notFound('No account is registered with this email address.', {
      code: 'ACCOUNT_NOT_FOUND',
    });
  }

  // // A Google-only account has no password to reset, ignore it
  // if (!user.passwordHash) {
  //   throw ApiError.badRequest(
  //     'This account signs in with Google. Use the "Continue with Google" button instead.',
  //     { code: 'OAUTH_ACCOUNT_NO_PASSWORD' },
  //   );
  // }

  const code = await withTransaction((client) =>
    issueOtpChallenge(user.id, 'password_reset', client),
  );

  await deliverOtpEmail(user.email, code, 'password_reset');

  // Same message regardless of outcome to avoid information leak
  return sendSuccess(res, { message: 'A reset code has been sent to your email.' });
});

// api/auth/verify-password-reset
const verifyPasswordReset = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  const user = await User.findByEmail(email);
  if (!user) {
    throw ApiError.badRequest('Invalid email or code');
  }

  const challenge = await consumeOtpChallenge({ userId: user.id, purpose: 'password_reset', code });
  const resetToken = signResetToken({ userId: user.id, challengeId: challenge.id });

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
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired reset authorization. Please restart password reset.');
  }

  const challenge = await AuthChallenge.findById(payload.cid);
  if (!challenge || !challenge.consumedAt || challenge.userId !== payload.sub) {
    throw ApiError.unauthorized('Invalid or expired reset authorization. Please restart password reset.');
  }

  const passwordHash = await hashPassword(password);
  await User.updatePasswordHash(payload.sub, passwordHash);

  return sendSuccess(res, { message: 'Password has been reset. Please log in with your new password.' });
});


// api/auth/refresh

// rmb = rememberMe (Seven day window)
// sxp = absolute session deadline (Thirty day window, absolute max)
// No revocation as these are stateless JWTs, meaning stolen cookies
// can still remain valid until sxp
// Implement JWT ID eventually
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies[REFRESH_COOKIE_NAME];
  if (!token) {
    throw ApiError.unauthorized('No refresh session found. Please log in again.');
  }

  let payload;
  try {
    payload = verifyRefreshToken(token);
    if (payload.type !== 'refresh') throw new Error('wrong token type');
  } catch {
    // Clears refresh cookies on any validation failure
    clearRefreshCookie(res, req);
    throw ApiError.unauthorized('Your session has expired. Please log in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    clearRefreshCookie(res, req);
    throw ApiError.unauthorized('Account no longer exists.');
  }

  const accessToken = signAccessToken(user);


  // Check for sxp, regardless of refresh/replacement cookie
  const remainingMs = refreshSessionRemainingMs(payload);
  if (remainingMs <= 0) {
    clearRefreshCookie(res, req);
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
      user: toAuthUserPayload(user),
    },
  });
});

// api/auth/logout
const logout = asyncHandler(async (req, res) => {
  clearRefreshCookie(res, req);
  return sendSuccess(res, { message: 'Logged out' });
});

// api/auth/me
const me = asyncHandler(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const profile = await UserProfile.findByUserId(req.userId);
  const goal = await UserGoal.findActiveByUserId(req.userId);
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
      gender: profile?.gender ?? null,
      activityLevel: profile?.activityLevel ?? null,
      dietPreference: profile?.dietPreference ?? null,
      healthConditions: profile?.healthConditions ?? null,
      notificationsEnabled: profile?.notificationsEnabled ?? true,
      avatarUrl: toPublicAvatarUrl(profile?.avatarStorageKey),
      weightKg: latestWeight?.weightKg ?? null,
      fitnessGoal: goal?.fitnessGoal ?? null,
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