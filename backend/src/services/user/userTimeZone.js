const User = require('../../models/user/User');

/**
 * The user's timezone decides what "today" and "this week" mean.
 *
 * Fetched rather than assumed: deriving the week from the server's clock puts a
 * Manila user's Monday-morning session in the wrong week for eight hours of
 * every day. The request's own zone wins; the stored one covers old clients
 */
async function userTimeZone(req) {
  if (req.timeZone) return req.timeZone;
  return (await User.getProfile(req.userId))?.timezone || undefined;
}

module.exports = { userTimeZone };