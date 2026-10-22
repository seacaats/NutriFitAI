// Allows OAuth popup handshakes across origins (helmet COOP is disabled in app.js)
function allowOauthPopup(req, res, next) {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  return next();
}

module.exports = { allowOauthPopup };