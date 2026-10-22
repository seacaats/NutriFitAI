const crypto = require('crypto');
const { withTransaction } = require('../../../config/mongo');
const User = require('../../models/user/User');
const AuthIdentity = require('../../models/auth/AuthIdentity');
const { signOauthExchangeToken, verifyOauthExchangeToken } = require('../../utils/auth/token');
const { isAllowedRedirectUri } = require('../../utils/auth/redirectUri');
const { saveRemoteAvatar, isUserUploaded } = require('../../utils/storage/avatarStore');
const { ApiError, asyncHandler } = require('../../utils/httpResponse');
const { logAction } = require('../../utils/audit-logs/auditLogger');
const { notify } = require('../../services/notifications/notify');
const { buildAuthUrl, exchangeCodeForProfile } = require('../../services/auth/googleOAuth');
const { accountHold } = require('../../services/auth/authResponses');
const { finishLogin, startMfaChallenge, logHeldLogin } = require('./loginController');

// GET /api/auth/google
const googleAuthStart = asyncHandler(async (req, res) => {
  const { redirectUri, popup } = req.query;

  if (!(await isAllowedRedirectUri(redirectUri))) {
    throw ApiError.badRequest('We couldn\'t start Google sign-in from this page. Please go back to the app and try again.');
  }

  const state = Buffer.from(
    JSON.stringify({ redirectUri, popup: popup === '1', nonce: crypto.randomUUID() }),
  ).toString('base64url');
  const url = buildAuthUrl(state);
  return res.redirect(url);
});

// GET /api/auth/google/callback
const googleAuthCallback = asyncHandler(async (req, res) => {
  const { code, state, error: googleError } = req.query;

  let redirectUri;
  let popup;
  try {
    ({ redirectUri, popup } = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')));
    if (!(await isAllowedRedirectUri(redirectUri))) throw new Error('redirect not allowlisted');
  } catch {
    throw ApiError.badRequest('Your Google sign-in session is no longer valid. Please go back to the app and try signing in again.');
  }

  const popupParam = popup ? '1' : '0';

  if (googleError || !code) {
    return res.redirect(`${redirectUri}?error=google_auth_failed&popup=${popupParam}`);
  }

  const profile = await exchangeCodeForProfile(code);
  if (!profile.emailVerified) {
    return res.redirect(`${redirectUri}?error=google_email_unverified&popup=${popupParam}`);
  }

  // Require an existing, email-verified account before linking or signing in via Google
  const registrationRequired = () => res.redirect(
    `${redirectUri}?error=registration_required`
      + `&email=${encodeURIComponent(profile.email)}&popup=${popupParam}`,
  );

  let user = await User.findByProviderIdentity('google', profile.googleId);

  if (user && !user.emailVerifiedAt) {
    return registrationRequired();
  }

  if (user) {
    if (profile.avatarUrl) {
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

// POST /api/auth/google/exchange
const googleExchange = asyncHandler(async (req, res) => {
  const { exchangeToken } = req.body;

  let payload;
  try {
    payload = verifyOauthExchangeToken(exchangeToken);
    if (payload.type !== 'oauth_exchange') throw new Error('wrong token type');
  } catch {
    throw ApiError.unauthorized('Your sign-in expired. Please try again.');
  }

  const user = await User.getById(payload.sub);
  if (!user) {
    throw ApiError.unauthorized('Your sign-in expired. Please try again.');
  }

  const hold = accountHold(user);
  if (hold) {
    await logHeldLogin(req, user, hold);
    throw hold.error;
  }

  if (user.mfa && user.mfa.enabled) return startMfaChallenge(res, user, true, 'google');

  return finishLogin(req, res, user, true, 'google');
});

module.exports = { googleAuthStart, googleAuthCallback, googleExchange };
