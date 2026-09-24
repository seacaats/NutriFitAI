// OAuth is set with this specific header and configuration to avoid
// reverse proxy, or any platform defaults to reintroduce a value
// that can break the popup handshake

function allowOauthPopup(req, res, next) {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  return next();
}

module.exports = { allowOauthPopup };