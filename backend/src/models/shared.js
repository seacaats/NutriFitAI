// Field definitions and helpers every model file shares. Constants
// only, no models, so nothing here registers a collection

const { CALENDAR_DAY_RE } = require('../utils/calendarDay');

// userId is plain string - users._id is a UUID string
const USER_REF = { type: String, required: true, ref: 'User' };

// Dates are plain validated strings instead Date objects
// to avoid timezone-shift bugs, or simply any inconsistent
// read/write/delivery of timezones for users
const CALENDAR_DAY = {
  type: String,
  validate: {
    validator: (v) => v === null || CALENDAR_DAY_RE.test(v),
    message: (p) => `${p.path} must be a YYYY-MM-DD string, received "${p.value}"`,
  },
};

// Lean documents for callers. Models speak "id", the database "_id",
// and ObjectIds are stringified so no call site has to know it's Mongo
function withId(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

module.exports = { USER_REF, CALENDAR_DAY, withId };