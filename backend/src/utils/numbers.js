// Rounded to one decimal. null and undefined stay null
const round1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);

module.exports = { round1 };