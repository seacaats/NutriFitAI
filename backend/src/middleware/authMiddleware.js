const { ApiError } = require('../utils/httpResponse');
const { verifyAccessToken } = require('../utils/auth/token');
const User = require('../models/user/User');
const DailyVisit = require('../models/user/DailyVisit');
const Session = require('../models/auth/Session');
const { today } = require('../utils/calendarDay');



/** Supported roles (must match `role` enum in models/user/User.js). */
const ROLES = ['user', 'admin'];
const DEFAULT_ROLE = 'user';

// ---- Timezone (X-Timezone header) -------------------------------------------

// Validates an IANA time zone string, returning null if invalid
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

// Populates req.timeZone from X-Timezone header
function readTimeZone(req, res, next) {
  req.timeZone = parseTimeZone(req.headers['x-timezone']);
  next();
}

// In-memory cache of last saved time zone per user to avoid redundant DB writes
const lastSaved = new Map();
const LAST_SAVED_MAX = 10000;

// Persists profile.timezone when it changes (fire-and-forget)
function rememberTimeZone(userId, zone) {
  if (!userId || !zone || lastSaved.get(userId) === zone) return;
  if (lastSaved.size >= LAST_SAVED_MAX) lastSaved.clear();
  lastSaved.set(userId, zone);

  User.updateOne(
    { _id: userId, 'profile.timezone': { $ne: zone } },
    { $set: { 'profile.timezone': zone } },
  ).catch(() => lastSaved.delete(userId));
}

const lastVisit = new Map();

// Records one daily visit per regular user for analytics (fire-and-forget)
function rememberVisit(userId, role, zone) {
  if (!userId || role !== 'user') return;
  const day = today(zone || 'UTC');
  if (lastVisit.get(userId) === day) return;
  if (lastVisit.size >= LAST_SAVED_MAX) lastVisit.clear();
  lastVisit.set(userId, day);
  DailyVisit.record(userId, day).catch(() => lastVisit.delete(userId));
}

/**
 * Verifies Bearer access token and populates req.userId, req.userEmail,
 * req.userRole, and req.sessionId.
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
    req.sessionId = payload.sid || null;
    rememberTimeZone(req.userId, req.timeZone);
    rememberVisit(req.userId, req.userRole, req.timeZone);
    return next();
  } catch (err) {
    return next(ApiError.unauthorized('Your session has expired. Please log in again.'));
  }
}

/**
 * Restricts route access to the specified roles. Must be mounted after requireAuth.
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
 * Reloads user role, session liveness, and suspension state from the database
 * so role revocations and suspensions take effect immediately on admin routes.
 * Mount order: requireAuth -> requireFreshRole -> requireRole.
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

    if (stored !== req.userRole) {
      // eslint-disable-next-line no-console
      console.warn(
        `[auth] role claim "${req.userRole}" superseded by stored role "${stored}" `
          + `for ${req.userId} on ${req.method} ${req.originalUrl}`,
      );
    }

    if (req.sessionId && !(await Session.isLive(req.sessionId, req.userId))) {
      return next(ApiError.unauthorized('Your session has ended. Please log in again.'));
    }

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
  requireFreshRole,
  readTimeZone,
};