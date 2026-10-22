const { mongoose, opts } = require('../../../config/mongo');

const { Schema } = mongoose;

// Holds a full copy of an audit_logs row (including hash) in a collection with no TTL
// so the entry survives past its normal retention window
const auditHoldSchema = new Schema(
  {
    _id: { type: String, required: true },
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

// Returns a Map of holds keyed by auditLogId (excluding the embedded row copy)
auditHoldSchema.statics.heldMap = async function heldMap(auditLogIds, client) {
  const rows = await this.find({ _id: { $in: auditLogIds.map(String) } }, { row: 0 }, opts(client)).lean();
  return new Map(rows.map((r) => [r._id, r]));
};

// All holds, newest first
auditHoldSchema.statics.listAll = async function listAll(client) {
  return this.find({}, null, opts(client)).sort({ createdAt: -1 }).lean();
};

module.exports = mongoose.model('AuditHold', auditHoldSchema);