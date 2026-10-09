/**
 * The admin and superadmin surface, split by topic: users and admins, the
 * audit log, and analytics.
 *
 * ONE CONTROLLER PER TOPIC, TWO AUDIENCES
 * ---------------------------------------
 * There is no separate superadminController, and that is deliberate. Every
 * endpoint here differs between the two roles by DEGREE -- more rows, more
 * columns, more actions -- not by kind, and splitting them would mean two
 * copies of the same query with the redaction rules drifting apart. Instead
 * the viewer's role is read once per request from req.userRole (refreshed
 * against the database by requireFreshRole, not trusted from the token) and
 * threaded into the two places that care: which actions the query matches,
 * and how each row is formatted.
 *
 * The rule that keeps that safe: a caller can never widen what they see. Every
 * visibility decision reads req.userRole; nothing reads the query string.
 */

const users = require('./usersController');
const audit = require('./auditController');
const analytics = require('./analyticsController');

module.exports = { ...users, ...audit, ...analytics };
