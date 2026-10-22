const User = require('../../models/user/User');

/**
 * Resolves the active IANA timezone for the request, preferring the request header over the stored profile timezone.
 */
async function userTimeZone(req) {
  if (req.timeZone) return req.timeZone;
  return (await User.getProfile(req.userId))?.timezone || undefined;
}

module.exports = { userTimeZone };
