/**
 * The workouts surface, split by topic: the catalog (wger data plus the user's
 * own workouts), logged sessions, and routines with their favorites and
 * schedule.
 */

module.exports = {
  ...require('./catalogController'),
  ...require('./sessionsController'),
  ...require('./routinesController'),
};