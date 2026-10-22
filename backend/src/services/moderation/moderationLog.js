const env = require('../../../config/env');
const ImageReview = require('../../models/moderation/ImageReview');
const User = require('../../models/user/User');
const { logSystemAction } = require('../../utils/audit-logs/auditLogger');

const STATUS = { review: 'review', block: 'blocked', unchecked: 'unchecked' };

// Writes audit entries for flagged/blocked images and repeat-block thresholds
async function auditModeration({ userId, kind }, result, status) {
  try {
    if (status === 'unchecked') return;

    const topScore = result.top ? Math.round(result.top.score * 100) / 100 : null;

    const { repeatBlocks, repeatWindowHours } = env.moderation;
    const recent = status === 'blocked' && repeatBlocks > 0
      ? await ImageReview.countBlocks(userId, new Date(Date.now() - repeatWindowHours * 3600 * 1000))
      : 0;

    const user = await User.getById(userId);
    await logSystemAction({
      userId,
      role: user?.role ?? null,
      actorLabel: User.displayName(user),
      action: status === 'review' ? 'moderation.image.flagged' : 'moderation.image.blocked',
      targetType: 'user',
      targetId: userId,
      targetLabel: User.displayName(user),
      targetRole: user?.role ?? null,
      details: {
        kind,
        categories: result.flagged.length ? result.flagged.join(', ') : result.top?.category ?? null,
        topScore,
      },
    });

    if (recent === repeatBlocks) {
      await logSystemAction({
        userId,
        role: user?.role ?? null,
        actorLabel: User.displayName(user),
        action: 'moderation.user.repeat_blocks',
        targetType: 'user',
        targetId: userId,
        targetLabel: User.displayName(user),
        targetRole: user?.role ?? null,
        details: { count: recent, hours: repeatWindowHours },
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[moderation] failed to audit', err);
  }
}

/**
 * Records non-clean image moderation results to the admin review queue and audit log.
 * Never throws so moderation logging cannot fail an upload.
 *
 * @param {{ userId: string, kind: 'avatar'|'scan'|'workout', storageKey?: string|null, refId?: string|number|null }} subject
 * @param {{ verdict: string, top: { category: string, score: number }|null, flagged: string[] }} result
 */
async function logModeration({ userId, kind, storageKey = null, refId = null }, result) {
  try {
    const status = STATUS[result.verdict];
    if (!status) return;

    await ImageReview.record({
      userId,
      kind,
      storageKey,
      refId: refId == null ? null : String(refId),
      status,
      flagged: result.flagged,
      topCategory: result.top?.category ?? null,
      topScore: result.top ? Math.round(result.top.score * 100) / 100 : null,
    });
    await auditModeration({ userId, kind }, result, status);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[moderation] failed to record', err);
  }
}

module.exports = { logModeration, auditModeration };
