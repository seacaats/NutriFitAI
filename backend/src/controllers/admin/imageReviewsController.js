const env = require('../../../config/env');
const ImageReview = require('../../models/moderation/ImageReview');
const User = require('../../models/user/User');
const storage = require('../../utils/storage');
const { removePhoto, photoNoticeVars } = require('../../services/moderation/removePhoto');
const { sendSuccess, ApiError, asyncHandler } = require('../../utils/httpResponse');
const { logAction } = require('../../utils/audit-logs/auditLogger');
const { notify } = require('../../services/notifications/notify');

const toRow = (review, user, recentBlocks = 0) => ({
  id: String(review._id),
  kind: review.kind,
  status: review.status,
  flagged: review.flagged,
  topCategory: review.topCategory,
  topScore: review.topScore,
  createdAt: review.createdAt,
  canView: review.status === 'review' && Boolean(review.storageKey),
  repeatOffender: recentBlocks > 0,
  recentBlocks,
  user: { id: review.userId, name: user ? User.displayName(user) : null, email: user?.email || null },
});

const targetEntry = (review, user) => ({
  targetType: 'user',
  targetId: review.userId,
  targetLabel: user ? User.displayName(user) : null,
  targetRole: user?.role || 'user',
});

async function loadOpenReview(id) {
  const review = await ImageReview.getById(id);
  if (!review) throw ApiError.notFound('Photo not found');
  if (review.status !== 'review') {
    throw ApiError.conflict('That photo was already handled.', { code: 'ALREADY_DECIDED' });
  }
  return review;
}

// Resolve open review/unchecked items whose underlying storage file no longer exists
async function settleGonePhotos(rows) {
  const open = rows.filter((r) => r.storageKey && (r.status === 'review' || r.status === 'unchecked'));
  const gone = (await Promise.all(open.map(async (r) => ((await storage.exists(r.storageKey)) ? null : r)))).filter(Boolean);
  await Promise.all(gone.map((r) => (r.status === 'review'
    ? ImageReview.decide(r._id, 'removed', null, 'The user already removed this photo')
    : ImageReview.discard(r._id))));
  return gone.length;
}

// GET /api/admin/image-reviews
const listImageReviews = asyncHandler(async (req, res) => {
  const { tab = 'review', page, limit, kind, category, days, userId, repeat } = req.validatedQuery || {};

  const { repeatBlocks, repeatWindowHours } = env.moderation;
  const offenders = repeatBlocks > 0
    ? await ImageReview.repeatBlockers(repeatBlocks, new Date(Date.now() - repeatWindowHours * 3600 * 1000))
    : new Map();

  const filter = {};
  if (kind) filter.kind = kind;
  if (category) filter.$or = [{ flagged: category }, { topCategory: category }];
  if (days) filter.createdAt = { $gte: new Date(Date.now() - days * 24 * 3600 * 1000) };
  if (userId) filter.userId = userId;
  if (repeat) filter.userId = userId ? (offenders.has(userId) ? userId : { $in: [] }) : { $in: [...offenders.keys()] };

  const read = () => ImageReview.listPage(tab, { page, limit, priorityUserIds: [...offenders.keys()], filter });
  let list = await read();
  for (let pass = 0; pass < 3 && (await settleGonePhotos(list.rows)); pass += 1) list = await read();
  const counts = await ImageReview.countByStatus();

  const users = await User.find({ _id: { $in: [...new Set(list.rows.map((r) => r.userId))] } }, 'email fullName role').lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  return sendSuccess(res, {
    data: {
      rows: list.rows.map((r) => toRow(r, byId.get(String(r.userId)), offenders.get(r.userId))),
      pagination: { page: list.page, limit: list.limit, total: list.total, pageCount: list.pageCount },
      counts: { review: counts.review || 0, blocked: counts.blocked || 0, unchecked: counts.unchecked || 0, repeatBlockers: offenders.size },
    },
  });
});

// GET /api/admin/image-reviews/:id/image
const viewImageReview = asyncHandler(async (req, res) => {
  const review = await loadOpenReview(req.params.id);
  if (!review.storageKey || !(await storage.exists(review.storageKey))) {
    throw ApiError.notFound('That photo is no longer stored.');
  }

  const user = await User.getById(review.userId);
  await logAction(req, { action: 'admin.image.viewed', ...targetEntry(review, user), details: { kind: review.kind } });

  return sendSuccess(res, { data: { url: await storage.urlFor(review.storageKey) } });
});

// POST /api/admin/image-reviews/:id/approve
const approveImageReview = asyncHandler(async (req, res) => {
  const review = await loadOpenReview(req.params.id);
  const decided = await ImageReview.decide(review._id, 'approved', req.userId, req.body.reason);
  if (!decided) throw ApiError.conflict('That photo was already handled.', { code: 'ALREADY_DECIDED' });

  const user = await User.getById(review.userId);
  await logAction(req, {
    action: 'admin.image.approved',
    ...targetEntry(review, user),
    details: { kind: review.kind, reason: req.body.reason },
  });
  return sendSuccess(res, { message: 'Photo approved' });
});

// POST /api/admin/image-reviews/:id/remove
const removeImageReview = asyncHandler(async (req, res) => {
  const review = await loadOpenReview(req.params.id);
  const decided = await ImageReview.decide(review._id, 'removed', req.userId, req.body.reason);
  if (!decided) throw ApiError.conflict('That photo was already handled.', { code: 'ALREADY_DECIDED' });

  await removePhoto(review);

  const user = await User.getById(review.userId);
  await logAction(req, {
    action: 'admin.image.removed',
    ...targetEntry(review, user),
    details: { kind: review.kind, reason: req.body.reason },
  });
  notify(review.userId, 'photo_removed_by_admin', { vars: photoNoticeVars(review.kind) });
  return sendSuccess(res, { message: 'Photo removed' });
});

module.exports = { listImageReviews, viewImageReview, approveImageReview, removeImageReview };
