const crypto = require('crypto');
const { mongoose, auditConnection, opts } = require('../../../config/mongo');
const { getActionDef, retentionDaysFor } = require('../../utils/audit-logs/actions');

const { Schema } = mongoose;

// Append-only. Reads serve the admin audit surface, and there's
// no update or delete on purpose: a trail that can be edited is not a trail.
// Outlives the document it tracks. Expires by severity (expiresAt, TTL index)
const auditLogSchema = new Schema(
  {
    // Nullable, different from what other parts of the code use (USER_REF),
    // so system actions and failed logins not tied to a specific user can be logged
    userId: { type: String, ref: 'User', default: null },

    // Snapshot of the actor's role at the time of action to avoid
    // inconsistencies if ever their roles change
    role: { type: String, maxlength: 30, default: null },
    // Whether the actor's email was verified at the time. null on system
    // actions with no actor
    actorVerified: { type: Boolean, default: null },

    // Snapshot of the actor's display name at the time
    // Same reasoning with role, changes in name may even lead to
    // data corruption
    actorLabel: { type: String, maxlength: 150, default: null },
    targetLabel: { type: String, maxlength: 150, default: null },

    // The subject's role at the time, beside the actor's
    // Nullable for self-directed actions or non-account targets
    targetRole: { type: String, maxlength: 30, default: null },

    // The action done. Naming convention: "auth.login.succeeded",
    // "admin.user.suspended", for filtering purposes. Actual permitted
    // values, along with their severity, and other details are in utils/audit-logs/actions/registry.js
    // Kept as a string rather than an enum to make any new tracked actions remain valid
    action: { type: String, required: true, maxlength: 100 },

    // Records what/who an action was directed to. Assumes a
    // self-directed action for blank entries
    targetType: { type: String, maxlength: 50, default: null },
    targetId: { type: String, default: null },

    details: { type: Schema.Types.Mixed, default: null },

    ipAddress: { type: String, maxlength: 64, default: null },
    userAgent: { type: String, maxlength: 300, default: null },

    createdAt: { type: Date, default: () => new Date() },

    // createdAt + RETENTION_DAYS[severity]. Removed by the audit_logs_expiry
    // TTL index
    expiresAt: { type: Date, required: true },

    // Hash chain, one per severity so TTL only ever trims a chain from its
    // oldest end. seq is unique per chain (audit_logs_chain_seq), which is
    // what makes two concurrent writers retry instead of forking the chain
    chain: { type: String, maxlength: 20, required: true },
    seq: { type: Number, required: true },
    prevHash: { type: String, maxlength: 64, required: true },
    hash: { type: String, maxlength: 64, required: true },
  },
  { versionKey: false, collection: 'audit_logs' },
);

// Indexes are created by migrations/001_nutrifitai.js and 004_nutrifitai.js, not declared here

// Blocks every update/delete path mongoose offers. Stops app code, not a
// database user -- that's MONGODB_AUDIT_URI's insert/find-only role. TTL
// deletes run inside MongoDB and never pass through here
function appendOnly() {
  throw new Error('audit_logs is append-only');
}
for (const op of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'replaceOne',
  'deleteOne',
  'deleteMany',
]) {
  auditLogSchema.pre(op, { document: true, query: true }, appendOnly);
}
auditLogSchema.pre('bulkWrite', appendOnly);
auditLogSchema.pre('save', function blockResave() {
  if (!this.isNew) appendOnly();
});

// ===========================================================================

// Hard ceiling on page size, beside the validator's own max (which reads it
// from here as AuditLog.MAX_PAGE_SIZE). Keeps an unvalidated internal caller
// from asking for 10,000 rows on a free-tier ops budget
auditLogSchema.statics.MAX_PAGE_SIZE = 100;

// Schema maxlengths, enforced by TRUNCATION instead of letting the validator
// throw. logAction swallows errors, so a 320-char User-Agent would lose the
// whole entry. The ellipsis marks a value as clipped
const MAX_USER_AGENT = 300;
const MAX_IP = 64;
const MAX_LABEL = 150;

function clip(value, max) {
  if (typeof value !== 'string') return value ?? null;
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

// Keeps _id beside id, the audit table reads both
function shape(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, _id, ...rest };
}

// Shared by list and countByAction so a filter can never apply to
// the page but not to its own total
function buildFilter(query) {
  const filter = {};

  if (Array.isArray(query.actions)) {
    filter.action = { $in: query.actions };
    // A note entry is only visible with the action it names
    filter.$nor = [{ action: 'admin.audit_log.note_added', 'details.notedAction': { $nin: query.actions } }];
  }

  // Only these rows (the "Noted" filter). Malformed ids are dropped, not cast
  if (Array.isArray(query.ids)) filter._id = { $in: query.ids.filter((id) => mongoose.isValidObjectId(id)) };

  // The actor did it.
  if (query.userId) filter.userId = query.userId;
  // It was done to them.
  if (query.targetId) filter.targetId = query.targetId;

  // subjectMode narrows it: "actor" (they did it), "target" (done to them),
  // "self" (both, e.g. editing their own profile). Default "all" is either side,
  // an $or over two indexed paths so the sort and total stay right
  if (query.subjectId) {
    const id = query.subjectId;
    if (query.subjectMode === 'actor') filter.userId = id;
    else if (query.subjectMode === 'target') filter.targetId = id;
    else if (query.subjectMode === 'self') Object.assign(filter, { userId: id, targetId: id });
    else filter.$or = [{ userId: id }, { targetId: id }];
  }

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = query.from;
    if (query.to) filter.createdAt.$lte = query.to;
  }

  return filter;
}

// ---- hash chain ------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const GENESIS = 'genesis';
// Concurrent writers on one chain collide on (chain, seq); the loser re-reads
// the tail and tries again
const MAX_CHAIN_RETRIES = 5;

// Fields covered by the hash, in a fixed order
const HASHED_FIELDS = [
  'chain', 'seq', 'prevHash', 'userId', 'role', 'actorVerified', 'actorLabel',
  'targetLabel', 'targetRole', 'action', 'targetType', 'targetId', 'details',
  'ipAddress', 'userAgent', 'createdAt', 'expiresAt',
];

// JSON with sorted keys, so a row hashes the same after a round trip through
// MongoDB whatever order its details keys come back in
function canonical(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function hashRow(row) {
  const body = HASHED_FIELDS.map((f) => canonical(row[f] ?? null)).join('|');
  return crypto.createHash('sha256').update(body).digest('hex');
}

// Exposed for scripts/rewrite-audit-roles.js, which has to re-hash rows
auditLogSchema.statics.hashRow = hashRow;

function isDuplicateKey(err) {
  return err && (err.code === 11000 || err.code === 11001);
}

auditLogSchema.statics.record = async function record(entry, client) {
  const chain = getActionDef(entry.action).severity;
  const base = {
    userId: entry.userId ?? null,
    role: entry.role ?? null,
    actorVerified: entry.actorVerified ?? null,
    actorLabel: clip(entry.actorLabel, MAX_LABEL),
    targetLabel: clip(entry.targetLabel, MAX_LABEL),
    targetRole: entry.targetRole ?? null,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    details: entry.details ?? null,
    ipAddress: clip(entry.ipAddress, MAX_IP),
    userAgent: clip(entry.userAgent, MAX_USER_AGENT),
  };

  for (let attempt = 1; ; attempt += 1) {
    const tail = await this.findOne({ chain }, { seq: 1, hash: 1 }, opts(client))
      .sort({ seq: -1 })
      .lean();

    const createdAt = new Date();
    const row = {
      ...base,
      chain,
      seq: tail ? tail.seq + 1 : 1,
      prevHash: tail ? tail.hash : GENESIS,
      createdAt,
      expiresAt: new Date(createdAt.getTime() + retentionDaysFor(entry.action) * DAY_MS),
    };
    row.hash = hashRow(row);

    try {
      const [doc] = await this.create([row], opts(client));
      return doc.toObject();
    } catch (err) {
      if (!isDuplicateKey(err) || attempt >= MAX_CHAIN_RETRIES) throw err;
    }
  }
};

// Re-hashes one chain oldest-first. The first surviving row may point at a
// row TTL already removed; anything after it must link exactly. Returns the
// first break, or null. Streams, so memory stays flat on a long chain
auditLogSchema.statics.verifyChain = async function verifyChain(chain) {
  const cursor = this.find({ chain }).sort({ seq: 1 }).lean().cursor();
  let prev = null;
  let checked = 0;

  for await (const row of cursor) {
    if (hashRow(row) !== row.hash) return { chain, brokenAt: String(row._id), reason: 'row edited', checked };
    if (prev && row.seq !== prev.seq + 1) return { chain, brokenAt: String(row._id), reason: 'row missing', checked };
    if (prev && row.prevHash !== prev.hash) return { chain, brokenAt: String(row._id), reason: 'link mismatch', checked };
    prev = row;
    checked += 1;
  }
  return null;
};

// Paginated feed for the audit table. `actions` is the viewer's allow-list,
// applied in the QUERY so pages aren't short and the total isn't wrong.
// Offset pagination: filtered, page-picked, and shallow in practice
auditLogSchema.statics.list = async function list(query, client) {
  const filter = buildFilter(query);

  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), this.MAX_PAGE_SIZE);
  const page = Math.max(Number(query.page) || 1, 1);
  const skip = (page - 1) * limit;

  // Two index-covered queries rather than one $facet
  const [rows, total] = await Promise.all([
    this.find(filter, null, opts(client))
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(filter, opts(client)),
  ]);

  return {
    rows: rows.map(shape),
    page,
    limit,
    total,
    pageCount: Math.max(Math.ceil(total / limit), 1),
  };
};

// One row by id, lean. null for a malformed id rather than a cast error
auditLogSchema.statics.getById = async function getById(id, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  return this.findById(id, null, opts(client)).lean();
};

// Which of these ids still exist (a held copy may outlive its row)
auditLogSchema.statics.existingIds = async function existingIds(ids, client) {
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  const rows = await this.find({ _id: { $in: valid } }, { _id: 1 }, opts(client)).lean();
  return new Set(rows.map((r) => String(r._id)));
};

// Every row matching the filters, newest first, for the CSV export. Capped
// so one export can't pull the whole collection on a free-tier ops budget
auditLogSchema.statics.EXPORT_MAX_ROWS = 10000;

auditLogSchema.statics.exportRows = async function exportRows(query, client) {
  const rows = await this.find(buildFilter(query), null, opts(client))
    .sort({ createdAt: -1 })
    .limit(this.EXPORT_MAX_ROWS)
    .lean();
  return rows.map(shape);
};

// Counts per action for the summary chips. The controller folds them into
// categories afterward, since category isn't a stored field
auditLogSchema.statics.countByAction = async function countByAction(query, client) {
  const rows = await this.aggregate([
    { $match: buildFilter(query) },
    { $group: { _id: '$action', count: { $sum: 1 } } },
  ]).session(opts(client).session || null);

  return rows.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});
};

// Bound to the restricted audit connection when one is configured
module.exports = (auditConnection || mongoose).model('AuditLog', auditLogSchema);