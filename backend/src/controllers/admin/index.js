/**
 * The admin surface, split by topic: users, the audit log, and analytics.
 * One controller per topic; the role is checked in adminRoutes
 * (requireFreshRole re-reads it from the database, not the token).
 */

const users = require('./usersController');
const audit = require('./auditController');
const analytics = require('./analyticsController');

module.exports = { ...users, ...audit, ...analytics };
