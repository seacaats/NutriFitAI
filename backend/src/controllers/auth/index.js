/**
 * The auth surface, split by topic: registration, login, two-factor, Google
 * OAuth, password reset and the session (refresh / logout / me).
 * Sign-in steps shared across them live in loginController.js; logic with
 * no HTTP in it is in services/auth.
 */

module.exports = {
  ...require('./registrationController'),
  login: require('./loginController').login,
  ...require('./mfaController'),
  ...require('./emailChangeController'),
  ...require('./googleController'),
  ...require('./passwordResetController'),
  ...require('./sessionController'),
};