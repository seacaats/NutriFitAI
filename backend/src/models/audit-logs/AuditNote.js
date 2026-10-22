const { mongoose, opts } = require('../../../config/mongo');

const { Schema } = mongoose;

// Append-only admin notes attached to audit rows
const auditNoteSchema = new Schema(
  {
    auditLogId: { type: String, required: true },
    authorId: { type: String, required: true },
    authorLabel: { type: String, maxlength: 150, default: null },
    authorRole: { type: String, maxlength: 30, default: null },
    body: { type: String, required: true, maxlength: 1000 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'audit_notes' },
);

// Indexes are created by migrations/004_nutrifitai.js, not declared here

auditNoteSchema.statics.add = async function add(input, client) {
  const [doc] = await this.create([input], opts(client));
  return doc.toObject();
};

// Oldest first, so a thread reads top to bottom
auditNoteSchema.statics.listFor = async function listFor(auditLogId, client) {
  return this.find({ auditLogId: String(auditLogId) }, null, opts(client)).sort({ createdAt: 1 }).lean();
};

// Note counts for a page of rows, as { [auditLogId]: n }
auditNoteSchema.statics.countsFor = async function countsFor(auditLogIds, client) {
  const rows = await this.aggregate([
    { $match: { auditLogId: { $in: auditLogIds.map(String) } } },
    { $group: { _id: '$auditLogId', count: { $sum: 1 } } },
  ]).session(opts(client).session || null);
  return Object.fromEntries(rows.map((r) => [r._id, r.count]));
};

// Ids of every audit row that has at least one note
auditNoteSchema.statics.notedIds = async function notedIds(client) {
  return this.distinct('auditLogId').session(opts(client).session || null);
};

module.exports = mongoose.model('AuditNote', auditNoteSchema);