// Normalize incoming goal inputs before bein stored
const GOALS = [
  { value: 'lose-weight', label: 'Lose Weight' },
  { value: 'gain-weight', label: 'Gain Weight' },
  { value: 'maintain-weight', label: 'Maintain Weight' },
  { value: 'build-muscle', label: 'Build Muscle' },
  { value: 'improve-fitness', label: 'Improve Fitness' },
];

const byValue = new Map(GOALS.map((g) => [g.value, g.value]));
const byLabel = new Map(GOALS.map((g) => [g.label.toLowerCase(), g.value]));

/**
 * @param {string} input machine value or display label from the client
 * @returns {string|null} canonical machine value, or null if unrecognized
 */
function normalizeGoal(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (byValue.has(raw)) return raw;
  const matched = byLabel.get(raw.toLowerCase());
  return matched || null;
}

module.exports = { normalizeGoal, GOALS };