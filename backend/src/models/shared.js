// Shared schema field definitions and helpers

const { CALENDAR_DAY_RE } = require('../utils/calendarDay');

// users._id is a UUID string
const USER_REF = { type: String, required: true, ref: 'User' };

// YYYY-MM-DD calendar day string (avoids Date timezone shifts)
const CALENDAR_DAY = {
  type: String,
  validate: {
    validator: (v) => v === null || CALENDAR_DAY_RE.test(v),
    message: (p) => `${p.path} must be a YYYY-MM-DD string, received "${p.value}"`,
  },
};

// Renames _id to stringified id on lean documents
function withId(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

module.exports = { USER_REF, CALENDAR_DAY, withId };