// The audit action registry (what each action is, who may see it, how long
// it's kept) and the formatter that renders stored rows for the admin table.
// See registry.js for the naming and `details` conventions

const registry = require('./registry');
const { formatAuditEntry } = require('./format');

module.exports = { ...registry, formatAuditEntry };
