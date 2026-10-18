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
    await logHeldLogin(req, user, hold);
    throw hold.error;
  }

  // Google stands in for the password only. Two-factor still follows: the emailed
  // code, or an admin's authenticator app (scanned in here on a first sign-in)
  if (user.mfa && user.mfa.enabled) return startMfaChallenge(res, user, true, 'google');

  return finishLogin(req, res, user, true, 'google');
});

module.exports = { googleAuthStart, googleAuthCallback, googleExchange };