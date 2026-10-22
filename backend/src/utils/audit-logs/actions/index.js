// Re-exports the audit action registry and row formatter.

const registry = require('./registry');
const { formatAuditEntry } = require('./format');

module.exports = { ...registry, formatAuditEntry };
