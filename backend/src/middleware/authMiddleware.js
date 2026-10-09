const { ApiError } = require('../utils/httpResponse');
const { verifyAccessToken } = require('../utils/auth/token');
const User = require('../models/user/User');
const DailyVisit = require('../models/user/DailyVisit');
const { today } = require('../utils/calendarDay');


// Synced with the "role" enum in models/user/User.js
/**
 * Every role the system knows about, weakest first. Must stay in sync with the
 * `role` enum in src/models/user/User.js -- a value accepted here but
 * rejected there (or vice versa) fails open.
 *
 * Order is load-bearing: requireMinimumRole compares indexes, so appending a
 * stronger role is safe while inserting one mid-list re-ranks everything after
 * it.
 */
const ROLES = ['user', 'admin', 'superadmin'];
const DEFAULT_ROLE = 'user';

// ---- Timezone (X-Timezone header) -------------------------------------------

// The client sends its IANA zone ("Asia/Manila") as X-Timezone on every
// request, so a user who travels gets correct "today"/"this week" right away

// Returns the zone if Intl recognises it, otherwise null
function parseTimeZone(value) {
  const zone = typeof value === 'string' ? value.trim() : '';
  if (!zone || zone.length > 64) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    return null;
  }
}

// Sets req.timeZone for every request, signed in or not
function readTimeZone(req, res, next) {
  req.timeZone = parseTimeZone(req.headers['x-timezone']);
  next();
}

// Last zone written per user, so the profile is only updated when it changes
// rather than on every request. Capped so it can't grow without limit
const lastSaved = new Map();
const LAST_SAVED_MAX = 10000;

// Keeps profile.timezone current for code that runs outside a request.
// Fire-and-forget: a failed write is retried on the user's next request
function rememberTimeZone(userId, zone) {
  if (!userId || !zone || lastSaved.get(userId) === zone) return;
  if (lastSaved.size >= LAST_SAVED_MAX) lastSaved.clear();
  lastSaved.set(userId, zone);

  User.updateOne(
    { _id: userId, 'profile.timezone': { $ne: zone } },
    { $set: { 'profile.timezone': zone } },
  ).catch(() => lastSaved.delete(userId));
}

// Day last recorded per user, so the visit is written once a day rather than
// on every request. Capped the same way as lastSaved
const lastVisit = new Map();

// Marks today (the user's own day) as one they used the app, for admin
// Analytics' active users. Regular users only: admins aren't app users here.
// Fire-and-forget like rememberTimeZone
function rememberVisit(userId, role, zone) {
  if (!userId || role !== 'user') return;
  const day = today(zone || 'UTC');
  if (lastVisit.get(userId) === day) return;
  if (lastVisit.size >= LAST_SAVED_MAX) lastVisit.clear();
  lastVisit.set(userId, day);
  DailyVisit.record(userId, day).catch(() => lastVisit.delete(userId));
}

/**
 * Populates req.userId / req.userEmail / req.userRole from a valid
 * "Authorization: Bearer <token>" header. All authenticated routes across the
 * app should derive ownership from req.userId — never from a client-submitted
 * body/query user id — and authorization from req.userRole, which comes from
 * the signed token rather than anything the client can set
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized('Please sign in to continue.'));
  }

  try {
    const payload = verifyAccessToken(token);
    if (payload.type !== 'access') {
      throw new Error('wrong token type');
    }
    req.userId = payload.sub;
    req.userEmail = payload.email;
    req.userRole = ROLES.includes(payload.role) ? payload.role : DEFAULT_ROLE;
    rememberTimeZone(req.userId, req.timeZone);
    rememberVisit(req.userId, req.userRole, req.timeZone);
    return next();
  } catch (err) {
    return next(ApiError.unauthorized('Your session has expired. Please log in again.'));
  }
}

/**
 * Restricts a route to the listed roles. Must be mounted *after* requireAuth,
 * which is what establishes req.userRole from the signed token.
 *
 *   router.get('/admin/users', requireAuth, requireRole('admin'), handler);
 *
 * Deny is the default: an unknown or missing role never satisfies the check.
 * Returns 403 (authenticated but not permitted) rather than 401, so the client
 * can tell "log in" apart from "you may not do this".
 */
function requireRole(...allowed) {
  const allowedRoles = allowed.flat();

  return function checkRole(req, res, next) {
    if (!req.userId) {
      return next(ApiError.unauthorized('Please sign in to continue.'));
    }
    if (!allowedRoles.includes(req.userRole)) {
      return next(
        ApiError.forbidden("You don't have permission to do that.", {
          code: 'INSUFFICIENT_ROLE',
        }),
      );
    }
    return next();
  };
}

/**
 * Hierarchical counterpart to requireRole: satisfied by the named role or any
 * stronger one, so `requireMinimumRole('admin')` admits a superadmin without
 * every admin route having to list both.
 *
 * Mirrors AuthContext.hasAtLeastRole on the client, and like requireRole it
 * denies by default -- an unknown role has index -1 and never clears the bar.
 */
function requireMinimumRole(minimum) {
  const needed = ROLES.indexOf(minimum);

  return function checkMinimumRole(req, res, next) {
    if (!req.userId) {
      return next(ApiError.unauthorized('Please sign in to continue.'));
    }
    const held = ROLES.indexOf(req.userRole);
    if (needed < 0 || held < needed) {
      return next(
        ApiError.forbidden("You don't have permission to do that.", {
          code: 'INSUFFICIENT_ROLE',
        }),
      );
    }
    return next();
  };
}

/**
 * Re-reads the caller's role from the database and overwrites req.userRole
 * with it, rejecting the request if the account is gone.
 *
 * WHY THIS EXISTS, given requireRole already works
 * ------------------------------------------------
 * requireRole trusts the role claim inside the signed access token, which is
 * the right default: it costs no query, and the token is unforgeable. But a
 * claim is a snapshot from when the token was issued, and access tokens live
 * 15 minutes (JWT_ACCESS_EXPIRES_IN). Revoking someone's admin therefore does
 * not take effect for up to 15 minutes, during which a demoted account can
 * still edit users and read the audit trail.
 *
 * Everywhere else in the app that window is harmless -- the worst case is a
 * user reading their own data slightly longer than intended. On the admin
 * surface it is the entire threat model, so these routes pay one indexed
 * primary-key lookup to close it.
 *
 * Mount order matters: requireAuth -> requireFreshRole -> requireMinimumRole,
 * so the role check reads the refreshed value rather than the token's.
 */
async function requireFreshRole(req, res, next) {
  if (!req.userId) {
    return next(ApiError.unauthorized('Please sign in to continue.'));
  }

  try {
    const user = await User.getById(req.userId);
    if (!user) {
      return next(ApiError.unauthorized('This account no longer exists.'));
    }

    const stored = ROLES.includes(user.role) ? user.role : DEFAULT_ROLE;

    // Loud on purpose: a mismatch means either a role was just changed (the
    // expected case, and the client's next /auth/me will pick it up) or a
    // token is carrying a claim the database disagrees with, which is worth
    // being able to find in a log afterwards.
    if (stored !== req.userRole) {
      // eslint-disable-next-line no-console
      console.warn(
        `[auth] role claim "${req.userRole}" superseded by stored role "${stored}" `
          + `for ${req.userId} on ${req.method} ${req.originalUrl}`,
      );
    }

    // A suspended admin loses the admin surface at once, not when their
    // access token expires
    if (user.suspendedAt) {
      return next(ApiError.forbidden('This account has been suspended. Contact support.', { code: 'ACCOUNT_SUSPENDED' }));
    }

    req.userRole = stored;
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  ROLES,
  DEFAULT_ROLE,
  requireAuth,
  requireRole,
  requireMinimumRole,
  requireFreshRole,
  readTimeZone,
};