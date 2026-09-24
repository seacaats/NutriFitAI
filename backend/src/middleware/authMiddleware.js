const { ApiError } = require('../utils/httpResponse');
const { verifyAccessToken } = require('../utils/auth/token');
const User = require('../models/user/User');


// Synced with the "role" enum in userSchema.js
/**
 * Every role the system knows about, weakest first. Must stay in sync with the
 * `role` enum in src/models/schemas/userSchema.js -- a value accepted here but
 * rejected there (or vice versa) fails open.
 *
 * Order is load-bearing: requireMinimumRole compares indexes, so appending a
 * stronger role is safe while inserting one mid-list re-ranks everything after
 * it.
 */
const ROLES = ['user', 'admin', 'superadmin'];
const DEFAULT_ROLE = 'user';

/** Roles that may reach the admin surface at all. */
const PRIVILEGED_ROLES = ['admin', 'superadmin'];

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
    return next(ApiError.unauthorized('Missing or malformed Authorization header'));
  }

  try {
    const payload = verifyAccessToken(token);
    if (payload.type !== 'access') {
      throw new Error('wrong token type');
    }
    req.userId = payload.sub;
    req.userEmail = payload.email;
    req.userRole = ROLES.includes(payload.role) ? payload.role : DEFAULT_ROLE;
    return next();
  } catch (err) {
    return next(ApiError.unauthorized('Invalid or expired access token'));
  }
}

/**
 * Like requireAuth, but does not fail the request if no/invalid token is
 * present — useful for endpoints that behave differently for guests vs.
 * authenticated users. Populates req.userId only when a token verifies.
 */
function attachUserIfPresent(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyAccessToken(token);
      if (payload.type === 'access') {
        req.userId = payload.sub;
        req.userEmail = payload.email;
        req.userRole = ROLES.includes(payload.role) ? payload.role : DEFAULT_ROLE;
      }
    } catch (err) {
      // ignore invalid token in optional mode
    }
  }
  return next();
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
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (!allowedRoles.includes(req.userRole)) {
      return next(
        ApiError.forbidden('You do not have permission to access this resource', {
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
      return next(ApiError.unauthorized('Authentication required'));
    }
    const held = ROLES.indexOf(req.userRole);
    if (needed < 0 || held < needed) {
      return next(
        ApiError.forbidden('You do not have permission to access this resource', {
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
 * primary-key lookup to close it. Exactly the same reasoning, and the same
 * shape, as requireVerifiedEmail reading emailVerifiedAt rather than trusting
 * a claim.
 *
 * Mount order matters: requireAuth -> requireFreshRole -> requireMinimumRole,
 * so the role check reads the refreshed value rather than the token's.
 */
async function requireFreshRole(req, res, next) {
  if (!req.userId) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return next(ApiError.unauthorized('Account no longer exists'));
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

    req.userRole = stored;
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Blocks users who haven't confirmed their email.
 *
 * Login already refuses unverified accounts, but a session can outlive that
 * check, so feature routes should state the requirement explicitly. Reads
 * users.email_verified_at directly rather than trusting a claim in the token:
 * verification can happen (or be revoked) after the token was signed.
 */
async function requireVerifiedEmail(req, res, next) {
  if (!req.userId) {
    return next(ApiError.unauthorized('Authentication required'));
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return next(ApiError.unauthorized('Account no longer exists'));
    }
    if (!user.emailVerifiedAt) {
      return next(
        ApiError.forbidden('Please verify your email address to continue', {
          code: 'EMAIL_NOT_VERIFIED',
        }),
      );
    }
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  ROLES,
  DEFAULT_ROLE,
  PRIVILEGED_ROLES,
  requireAuth,
  attachUserIfPresent,
  requireRole,
  requireMinimumRole,
  requireFreshRole,
  requireVerifiedEmail,
};