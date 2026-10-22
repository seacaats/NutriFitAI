const env = require('../../../config/env');
const { ApiError } = require('../../utils/httpResponse');

// Image moderation categories supported by OpenAI omni-moderation
const IMAGE_CATEGORIES = [
  'sexual',
  'violence',
  'violence/graphic',
  'self-harm',
  'self-harm/intent',
  'self-harm/instructions',
];

const UNCHECKED = { verdict: 'unchecked', top: null, flagged: [] };

/**
 * Moderates an image buffer without throwing on provider outages.
 *
 *   allow      clean or moderation disabled
 *   review     flagged or >= MODERATION_REVIEW_SCORE (below MODERATION_BLOCK_SCORE)
 *   block      >= MODERATION_BLOCK_SCORE
 *   unchecked  provider failed or timed out
 *
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @returns {Promise<{ verdict: 'allow'|'review'|'block'|'unchecked', top: { category: string, score: number }|null, flagged: string[] }>}
 */
async function moderateImage(buffer, mimetype) {
  const cfg = env.moderation;
  if (!cfg.enabled) return { verdict: 'allow', top: null, flagged: [] };

  try {
    const type = (mimetype || '').split(';')[0].trim().toLowerCase();
    const response = await fetch(`${cfg.baseUrl}/moderations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        input: [{ type: 'image_url', image_url: { url: `data:${type};base64,${buffer.toString('base64')}` } }],
      }),
      signal: AbortSignal.timeout(cfg.timeoutMs),
    });
    if (!response.ok) return UNCHECKED;

    const result = (await response.json()).results?.[0];
    if (!result) return UNCHECKED;

    const top = IMAGE_CATEGORIES
      .map((category) => ({ category, score: result.category_scores?.[category] ?? 0 }))
      .sort((a, b) => b.score - a.score)[0];
    const flagged = IMAGE_CATEGORIES.filter((category) => result.categories?.[category]);

    let verdict = 'allow';
    if (top.score >= cfg.blockScore) verdict = 'block';
    else if (flagged.length || top.score >= cfg.reviewScore) verdict = 'review';
    if (cfg.logScores) console.log(`[moderation] ${verdict} ${top.category} ${top.score.toFixed(2)}`);
    return { verdict, top, flagged };
  } catch {
    return UNCHECKED;
  }
}

function throwIfRejected(result, failClosed = false) {
  if (result.verdict === 'block') {
    throw new ApiError(
      422,
      "That photo was blocked because it may not meet our guidelines. Please choose a different one. Repeated violations can lead to your account being suspended.",
      { code: 'PHOTO_REJECTED' },
    );
  }
  if (failClosed && result.verdict === 'unchecked') {
    throw new ApiError(503, "We couldn't check that photo right now. Please try again in a moment.", { code: 'MODERATION_UNAVAILABLE' });
  }
}

async function assertImageAllowed(buffer, mimetype, { failClosed = false } = {}) {
  const result = await moderateImage(buffer, mimetype);
  throwIfRejected(result, failClosed);
  return result;
}

module.exports = { moderateImage, assertImageAllowed, throwIfRejected };
