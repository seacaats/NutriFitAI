const { mongoose, opts } = require('../../../config/mongo');

const { Schema } = mongoose;

// A row kept past its expiry. audit_logs rows can't be changed (append-only,
// and expiresAt is part of their hash), so a hold is a COPY of the row, hash
// and all, in a collection with no TTL. The copy still verifies against the
// chain. Releasing the hold deletes the copy; both are audited
const auditHoldSchema = new Schema(
  {
    // The audit_logs _id, as a string. One hold per row
    _id: { type: String, required: true },

    // The whole lean row as it stood when held
    row: { type: Schema.Types.Mixed, required: true },

    reason: { type: String, required: true, maxlength: 300 },
    heldBy: { type: String, required: true },
    heldByLabel: { type: String, maxlength: 150, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'audit_holds' },
);

// Indexes are created by migrations/004_nutrifitai.js, not declared here

auditHoldSchema.statics.hold = async function hold(row, { reason, heldBy, heldByLabel }, client) {
  const [doc] = await this.create(
    [{ _id: String(row._id), row, reason, heldBy, heldByLabel }],
    opts(client),
  );
  return doc.toObject();
};

auditHoldSchema.statics.release = async function release(auditLogId, client) {
  return this.findOneAndDelete({ _id: String(auditLogId) }, opts(client)).lean();
};

auditHoldSchema.statics.getByAuditLogId = async function getByAuditLogId(auditLogId, client) {
  return this.findById(String(auditLogId), null, opts(client)).lean();
};

// The holds on a page's rows (reason, who, when), as a Map keyed by id
auditHoldSchema.statics.heldMap = async function heldMap(auditLogIds, client) {
  const rows = await this.find({ _id: { $in: auditLogIds.map(String) } }, { row: 0 }, opts(client)).lean();
  return new Map(rows.map((r) => [r._id, r]));
};

// Every hold, newest first. Small by nature (a hold is a deliberate act), so
// the allow-list and the page are applied by the caller in memory
auditHoldSchema.statics.listAll = async function listAll(client) {
  return this.find({}, null, opts(client)).sort({ createdAt: -1 }).lean();
};

module.exports = mongoose.model('AuditHold', auditHoldSchema);