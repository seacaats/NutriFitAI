// Rounds a number to one decimal place, preserving null/undefined
const round1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);

module.exports = { round1 };
