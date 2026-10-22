// Normalizes fitness goal inputs to canonical slugs or trimmed custom strings.
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
 * @param {string} input
 * @returns {string|null}
 */
function normalizeGoal(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  if (byValue.has(raw)) return raw;
  return byLabel.get(raw.toLowerCase()) || raw;
}

module.exports = { normalizeGoal };
