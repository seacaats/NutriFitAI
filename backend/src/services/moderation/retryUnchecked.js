const env = require('../../../config/env');
const ImageReview = require('../../models/moderation/ImageReview');
const storage = require('../../utils/storage');
const { moderateImage } = require('./imageModeration');
const { auditModeration } = require('./moderationLog');
const { removePhoto, photoNoticeVars } = require('./removePhoto');
const { notify } = require('../notifications/notify');

// Background job to re-evaluate photos left 'unchecked' during moderation provider outages.
const RUN_EVERY_MS = 15 * 60 * 1000;
const BATCH = 20;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

const TYPE_BY_EXT = Object.fromEntries(Object.entries(storage.keys.EXT_BY_TYPE).map(([type, ext]) => [ext, type]));
const typeOf = (key) => TYPE_BY_EXT[String(key).split('.').pop().toLowerCase()];

async function runUncheckedRetry() {
  if (!env.moderation.enabled) return;
  try {
    const rows = await ImageReview.nextUnchecked(MAX_AGE_MS, BATCH);
    for (const row of rows) {
      const bytes = await storage.read(row.storageKey);
      const mimetype = typeOf(row.storageKey);
      if (!bytes || !mimetype) {
        await ImageReview.discard(row._id);
        continue;
      }

      const result = await moderateImage(bytes, mimetype);
      if (result.verdict === 'unchecked') {
        await ImageReview.markTried(row._id);
        continue;
      }
      if (result.verdict === 'allow') {
        await ImageReview.discard(row._id);
        continue;
      }

      const blocked = result.verdict === 'block';
      const status = blocked ? 'blocked' : 'review';
      const settled = await ImageReview.settle(row._id, {
        status,
        flagged: result.flagged,
        topCategory: result.top?.category ?? null,
        topScore: result.top ? Math.round(result.top.score * 100) / 100 : null,
        ...(blocked ? { storageKey: null } : {}),
      });
      if (!settled) continue;

      if (blocked) {
        await removePhoto(row);
        notify(row.userId, 'photo_removed_by_check', { vars: photoNoticeVars(row.kind) });
      }
      await auditModeration({ userId: row.userId, kind: row.kind }, result, status);
    }
  } catch (err) {
    console.error('[moderation] unchecked retry failed', err);
  }
}

module.exports = { runUncheckedRetry, RUN_EVERY_MS };
