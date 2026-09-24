const db = require('../../config/mongo');
const { AuditLogDoc } = require('./schemas');

const { opts } = db;

/**
 * Append-only store over audit_logs. See the schema comment in
 * models/schemas/index.js for why this collection has no TTL and is never
 * pruned automatically.
 *
 * READS were added for the admin/superadmin audit surface. There is still no
 * update and no delete, and there should never be one: a trail that can be
 * edited is not a trail. A retention decision, if one is ever made, belongs in
 * a deliberate script rather than a method sitting here where a controller
 * could reach it.
 */

/**
 * Hard ceiling on page size, separate from the validator's own max.
 *
 * Belt and braces on Atlas free tier: the sort behind every query here is
 * index-covered, but the RESULT still has to be materialised and serialised,
 * and a caller that manages to ask for 10,000 rows would spend the ops/sec
 * budget on one request. The validator rejects oversized input politely; this
 * makes an unvalidated internal caller safe too.
 */
const MAX_PAGE_SIZE = 100;

function shape(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, _id, ...rest };
}

/**
 * Schema maxlengths, enforced here by TRUNCATION rather than left to
 * Mongoose's validator to reject.
 *
 * This is a silent-data-loss fix, not tidiness. The chain is:
 *   - auditLogSchema declares userAgent maxlength 300;
 *   - Model.create() runs validators and THROWS on a longer value;
 *   - logAction catches and swallows every error, by design, so that an
 *     audit write can never fail the user-facing action it describes.
 *
 * So a browser sending a 320-character User-Agent -- entirely ordinary for
 * some mobile, in-app and embedded browsers -- loses its audit entry
 * completely, with nothing but a console line to show for it. The rows most
 * likely to vanish are the unusual clients, which are exactly the rows worth
 * keeping.
 *
 * Truncating keeps the entry. A clipped user agent is still identifying; a
 * missing entry is nothing at all. The ellipsis marks it as clipped so nobody
 * reads a truncated string as the complete one.
 */
const MAX_USER_AGENT = 300;
const MAX_IP = 64;
const MAX_LABEL = 150;

function clip(value, max) {
  if (typeof value !== 'string') return value ?? null;
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

const AuditLog = {
  /**
   * @param {{
   *   userId?: string|null,
   *   role?: string|null,
   *   actorLabel?: string|null,
   *   targetLabel?: string|null,
   *   targetRole?: string|null,
   *   action: string,
   *   targetType?: string|null,
   *   targetId?: string|null,
   *   details?: object|null,
   *   ipAddress?: string|null,
   *   userAgent?: string|null,
   * }} entry
   * @param {import('mongoose').ClientSession} [client]
   */
  async record(entry, client = db) {
    const doc = await AuditLogDoc.create(
      [
        {
          userId: entry.userId ?? null,
          role: entry.role ?? null,
          actorLabel: clip(entry.actorLabel, MAX_LABEL),
          targetLabel: clip(entry.targetLabel, MAX_LABEL),
          targetRole: entry.targetRole ?? null,
          action: entry.action,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          details: entry.details ?? null,
          ipAddress: clip(entry.ipAddress, MAX_IP),
          // See the clip() comment: an over-long User-Agent would otherwise
          // throw inside create(), be swallowed by logAction, and lose the
          // entry entirely.
          userAgent: clip(entry.userAgent, MAX_USER_AGENT),
        },
      ],
      opts(client),
    );
    return doc[0].toObject();
  },

  /**
   * Paginated feed for the audit table.
   *
   * `actions` is the caller's allow-list, and it is NOT optional in practice:
   * the controller passes visibleActionsFor(viewerRole), so an entry an admin
   * may not see is excluded by the QUERY rather than filtered out of the
   * result. That distinction matters for pagination -- post-filtering would
   * return short pages and a wrong total, and "why does page 3 have four rows"
   * is a bug report nobody enjoys.
   *
   * OFFSET pagination rather than a cursor, on purpose. A cursor would be
   * strictly better for deep scrolling, but this table is read newest-first
   * with filters and a page picker, the collection is small enough that skip()
   * stays cheap at the depths a human actually reaches, and the sort key
   * (createdAt) is not unique so a naive cursor would skip or repeat rows
   * written in the same millisecond. Revisit if anyone paginates past a few
   * thousand.
   *
   * @param {{
   *   actions: string[],
   *   category?: string|null,
   *   userId?: string|null,
   *   targetId?: string|null,
   *   subjectId?: string|null,
   *   from?: Date|null,
   *   to?: Date|null,
   *   page?: number,
   *   limit?: number,
   * }} query
   */
  async list(query, client = db) {
    const filter = buildFilter(query);

    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), MAX_PAGE_SIZE);
    const page = Math.max(Number(query.page) || 1, 1);
    const skip = (page - 1) * limit;

    /**
     * Count and page are two round trips rather than one $facet aggregation.
     *
     * $facet would halve the round trips but runs the whole match twice in a
     * single pipeline stage that cannot use an index for the sort branch on a
     * shared tier -- which is the failure mode the { createdAt: -1 } index
     * exists to avoid. Two simple index-covered queries beat one clever
     * pipeline here.
     */
    const [rows, total] = await Promise.all([
      AuditLogDoc.find(filter, null, opts(client))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLogDoc.countDocuments(filter).session(opts(client).session || null),
    ]);

    return {
      rows: rows.map(shape),
      page,
      limit,
      total,
      pageCount: Math.max(Math.ceil(total / limit), 1),
    };
  },

  /**
   * Counts per action over a window, for the summary chips above the table.
   *
   * Grouped by action rather than by the registry's `category` because
   * category is a read-time property of the registry, not a stored field --
   * aggregating on it would mean either storing derived data (which goes
   * stale the moment the registry is edited) or a $switch listing every
   * action inline. The controller folds actions into categories after the
   * fact, over at most a few dozen rows.
   */
  async countByAction(query, client = db) {
    const filter = buildFilter(query);
    const rows = await AuditLogDoc.aggregate([
      { $match: filter },
      { $group: { _id: '$action', count: { $sum: 1 } } },
    ]).session(opts(client).session || null);

    return rows.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});
  },
};

/**
 * Shared between list() and countByAction() so a filter can never apply to the
 * page but not to its own total -- the classic pagination bug where the count
 * query drifts from the find query.
 */
function buildFilter(query) {
  const filter = {};

  if (Array.isArray(query.actions)) {
    filter.action = { $in: query.actions };
  }

  // The actor did it.
  if (query.userId) filter.userId = query.userId;
  // It was done to them.
  if (query.targetId) filter.targetId = query.targetId;

  /**
   * "Everything involving this account", either side of the action -- what
   * the per-user drawer on the users management page wants.
   *
   * $or over two indexed paths, not a $lookup and not two calls merged in
   * JavaScript: merging client-side would break the sort across the boundary
   * and make `total` a guess. Mongo can use { userId, createdAt } and
   * { targetId, createdAt } for the two branches respectively.
   */
  if (query.subjectId) {
    filter.$or = [{ userId: query.subjectId }, { targetId: query.subjectId }];
  }

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = query.from;
    if (query.to) filter.createdAt.$lte = query.to;
  }

  return filter;
}

module.exports = AuditLog;
module.exports.MAX_PAGE_SIZE = MAX_PAGE_SIZE;
