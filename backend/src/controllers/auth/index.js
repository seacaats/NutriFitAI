module.exports = {
  ...require('./registrationController'),
  login: require('./loginController').login,
  ...require('./mfaController'),
  ...require('./emailChangeController'),
  ...require('./googleController'),
  ...require('./passwordResetController'),
  ...require('./sessionController'),
};
