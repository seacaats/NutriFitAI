const crypto = require('crypto');
const { mongoose, auditConnection, opts } = require('../../../config/mongo');
const { getActionDef, retentionDaysFor } = require('../../utils/audit-logs/actions');

const { Schema } = mongoose;

// Append-only audit log with severity-based TTL expiry and per-severity hash chains.
const auditLogSchema = new Schema(
  {
    // Nullable for system actions and unattributed failed logins
    userId: { type: String, ref: 'User', default: null },

    // Actor and target snapshots at the time of the action
    role: { type: String, maxlength: 30, default: null },
    actorVerified: { type: Boolean, default: null },
    actorLabel: { type: String, maxlength: 150, default: null },
    targetLabel: { type: String, maxlength: 150, default: null },
    targetRole: { type: String, maxlength: 30, default: null },

    // Dotted action key (see utils/audit-logs/actions/registry.js)
    action: { type: String, required: true, maxlength: 100 },

    // Null when self-directed
    targetType: { type: String, maxlength: 50, default: null },
    targetId: { type: String, default: null },

    details: { type: Schema.Types.Mixed, default: null },

    ipAddress: { type: String, maxlength: 64, default: null },
    userAgent: { type: String, maxlength: 300, default: null },

    createdAt: { type: Date, default: () => new Date() },
    expiresAt: { type: Date, required: true },

    // Per-severity hash chain; unique (chain, seq) forces concurrent writers to retry
    chain: { type: String, maxlength: 20, required: true },
    seq: { type: Number, required: true },
    prevHash: { type: String, maxlength: 64, required: true },
    hash: { type: String, maxlength: 64, required: true },
  },
  { versionKey: false, collection: 'audit_logs' },
);

// Block Mongoose update/delete paths (TTL deletes run inside MongoDB)
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

auditLogSchema.statics.MAX_PAGE_SIZE = 100;

// Truncate instead of failing validation so oversized metadata never drops an audit entry
const MAX_USER_AGENT = 300;
const MAX_IP = 64;
const MAX_LABEL = 150;

function clip(value, max) {
  if (typeof value !== 'string') return value ?? null;
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function shape(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, _id, ...rest };
}

function buildFilter(query) {
  const filter = {};

  if (Array.isArray(query.actions)) {
    filter.action = { $in: query.actions };
    // Show note entries only alongside their referenced action
    filter.$nor = [{ action: 'admin.audit_log.note_added', 'details.notedAction': { $nin: query.actions } }];
  }

  if (Array.isArray(query.ids)) filter._id = { $in: query.ids.filter((id) => mongoose.isValidObjectId(id)) };

  if (query.userId) filter.userId = query.userId;
  if (query.targetId) filter.targetId = query.targetId;

  // subjectMode: "actor" | "target" | "self" | "all" (default)
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
const MAX_CHAIN_RETRIES = 5;

const HASHED_FIELDS = [
  'chain', 'seq', 'prevHash', 'userId', 'role', 'actorVerified', 'actorLabel',
  'targetLabel', 'targetRole', 'action', 'targetType', 'targetId', 'details',
  'ipAddress', 'userAgent', 'createdAt', 'expiresAt',
];

// Deterministic JSON serialization with sorted keys
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

// Stream and verify a chain oldest-first; returns the first break or null
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

auditLogSchema.statics.list = async function list(query, client) {
  const filter = buildFilter(query);

  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), this.MAX_PAGE_SIZE);
  const page = Math.max(Number(query.page) || 1, 1);
  const skip = (page - 1) * limit;

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

auditLogSchema.statics.getById = async function getById(id, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  return this.findById(id, null, opts(client)).lean();
};

auditLogSchema.statics.existingIds = async function existingIds(ids, client) {
  const valid = ids.filter((id) => mongoose.isValidObjectId(id));
  const rows = await this.find({ _id: { $in: valid } }, { _id: 1 }, opts(client)).lean();
  return new Set(rows.map((r) => String(r._id)));
};

auditLogSchema.statics.EXPORT_MAX_ROWS = 10000;

auditLogSchema.statics.exportRows = async function exportRows(query, client) {
  const rows = await this.find(buildFilter(query), null, opts(client))
    .sort({ createdAt: -1 })
    .limit(this.EXPORT_MAX_ROWS)
    .lean();
  return rows.map(shape);
};

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

module.exports = (auditConnection || mongoose).model('AuditLog', auditLogSchema);