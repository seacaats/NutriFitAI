const User = require('../../models/user/User');
const AuditLog = require('../../models/audit-logs/AuditLog');
const AuditHold = require('../../models/audit-logs/AuditHold');
const AuditNote = require('../../models/audit-logs/AuditNote');
const { sendSuccess, ApiError, asyncHandler } = require('../../utils/httpResponse');
const { logAction } = require('../../utils/audit-logs/auditLogger');
const {
  AUDIT_ACTIONS,
  CATEGORIES,
  SEVERITIES,
  getActionDef,
  formatAuditEntry,
} = require('../../utils/audit-logs/actions');

// ===========================================================================
// Audit log
// ===========================================================================

function auditFilters(query) {
  return {
    category: query.category ?? null,
    action: query.action ?? null,
    subjectId: query.subjectId ?? null,
    subjectMode: query.subjectId ? (query.subjectMode ?? 'all') : null,
    from: query.from ?? null,
    to: query.to ?? null,
    held: query.held === 'true',
    noted: query.noted === 'true',
  };
}

// Paginate held audit entries, flagging entries whose original row has expired via TTL
async function listHeld(actions, query) {
  const allowed = new Set(actions);
  const holds = (await AuditHold.listAll()).filter((h) => allowed.has(h.row.action));

  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), AuditLog.MAX_PAGE_SIZE);
  const page = Math.max(Number(query.page) || 1, 1);
  const slice = holds.slice((page - 1) * limit, page * limit);
  const live = await AuditLog.existingIds(slice.map((h) => h._id));

  return {
    rows: slice.map((h) => h.row),
    heldCopies: new Set(slice.filter((h) => !live.has(h._id)).map((h) => h._id)),
    page,
    limit,
    total: holds.length,
    pageCount: Math.max(Math.ceil(holds.length / limit), 1),
  };
}

async function annotate(rows, heldCopies = new Set()) {
  const ids = rows.map((r) => String(r._id));
  const [held, notes] = await Promise.all([AuditHold.heldMap(ids), AuditNote.countsFor(ids)]);
  return rows.map((entry) => {
    const id = String(entry._id);
    return {
      ...formatAuditEntry(entry),
      held: held.has(id),
      hold: held.has(id)
        ? { reason: held.get(id).reason, by: held.get(id).heldByLabel, at: held.get(id).createdAt }
        : null,
      heldCopy: heldCopies.has(id),
      noteCount: notes[id] || 0,
    };
  });
}

// Load a live audit row or its held copy
async function loadAuditRow(req) {
  const row = (await AuditLog.getById(req.params.id)) || (await AuditHold.getByAuditLogId(req.params.id))?.row;
  if (!row || !AUDIT_ACTIONS[row.action]) throw ApiError.notFound('Audit entry not found');
  return row;
}

// GET /api/admin/audit-logs/:id/notes
const listAuditNotes = asyncHandler(async (req, res) => {
  await loadAuditRow(req);
  const notes = await AuditNote.listFor(req.params.id);
  return sendSuccess(res, {
    data: notes.map((n) => ({
      id: String(n._id),
      body: n.body,
      author: n.authorLabel,
      authorRole: n.authorRole,
      createdAt: n.createdAt,
    })),
  });
});

// POST /api/admin/audit-logs/:id/notes
const addAuditNote = asyncHandler(async (req, res) => {
  const row = await loadAuditRow(req);
  const note = await AuditNote.add({
    auditLogId: req.params.id,
    authorId: req.userId,
    authorLabel: User.displayName(req.user),
    authorRole: req.userRole,
    body: req.body.body,
  });

  await logAction(req, {
    action: 'admin.audit_log.note_added',
    targetType: 'system',
    targetId: null,
    details: { auditLogId: req.params.id, notedAction: row.action },
  });

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Note added',
    data: { id: String(note._id), body: note.body, author: note.authorLabel, authorRole: note.authorRole, createdAt: note.createdAt },
  });
});

// POST /api/admin/audit-logs/:id/hold
const holdAuditLog = asyncHandler(async (req, res) => {
  const row = await AuditLog.getById(req.params.id);
  if (!row || !AUDIT_ACTIONS[row.action]) throw ApiError.notFound('Audit entry not found');
  if (await AuditHold.getByAuditLogId(req.params.id)) {
    throw ApiError.badRequest('That entry is already on hold.', { code: 'ALREADY_HELD' });
  }

  await AuditHold.hold(row, { reason: req.body.reason, heldBy: req.userId, heldByLabel: User.displayName(req.user) });
  await logAction(req, {
    action: 'admin.audit_log.held',
    targetType: 'system',
    targetId: null,
    details: { auditLogId: req.params.id, heldAction: row.action, reason: req.body.reason },
  });

  return sendSuccess(res, { message: 'Entry held', data: { id: req.params.id, held: true } });
});

// DELETE /api/admin/audit-logs/:id/hold
const releaseAuditHold = asyncHandler(async (req, res) => {
  const released = await AuditHold.release(req.params.id);
  if (!released) throw ApiError.notFound("That entry isn't on hold.");

  await logAction(req, {
    action: 'admin.audit_log.hold_released',
    targetType: 'system',
    targetId: null,
    details: { auditLogId: req.params.id, heldAction: released.row.action, reason: req.body.reason },
  });

  return sendSuccess(res, { message: 'Hold released', data: { id: req.params.id, held: false } });
});

// Rate-limit audit-log view events per admin (separate cooldowns for general browsing vs. subject lookup)
const AUDIT_VIEW_COOLDOWN_MS = 5 * 60 * 1000;
const lastAuditViewAt = new Map();

function auditViewDue(userId, query) {
  const key = query.subjectId
    ? `${userId}:${query.subjectId}:${query.subjectMode ?? 'all'}`
    : `${userId}:browse`;
  const last = lastAuditViewAt.get(key);
  if (last && Date.now() - last < AUDIT_VIEW_COOLDOWN_MS) return false;
  if (lastAuditViewAt.size > 5000) lastAuditViewAt.clear();
  lastAuditViewAt.set(key, Date.now());
  return true;
}

// GET /api/admin/audit-logs
const listAuditLogs = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || {};

  let actions = Object.keys(AUDIT_ACTIONS);

  if (query.category) {
    actions = actions.filter((action) => getActionDef(action).category === query.category);
  }

  if (query.action) {
    actions = actions.filter((action) => action === query.action);
  }

  const result = query.held === 'true'
    ? await listHeld(actions, query)
    : await AuditLog.list({
      actions,
      ids: query.noted === 'true' ? await AuditNote.notedIds() : undefined,
      subjectId: query.subjectId,
      subjectMode: query.subjectMode,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    });

  if (result.page === 1 && auditViewDue(req.userId, query)) {
    await logAction(req, {
      action: 'admin.audit_log.viewed',
      targetType: 'system',
      targetId: null,
      details: {
        filters: auditFilters(query),
      },
    });
  }

  return sendSuccess(res, {
    data: {
      rows: await annotate(result.rows, result.heldCopies),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pageCount: result.pageCount,
      },
    },
  });
});

// GET /api/admin/audit-logs/export
const CSV_COLUMNS = [
  'createdAt', 'action', 'label', 'category', 'severity', 'message', 'details', 'actor', 'actorId',
  'actorRole', 'target', 'targetId', 'targetType', 'ipAddress', 'userAgent',
];

// Quote CSV cell and neutralize spreadsheet formula prefixes (=, +, -, @)
function csvCell(value) {
  if (value === null || value === undefined) return '""';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const exportAuditLogs = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || {};
  let actions = Object.keys(AUDIT_ACTIONS);
  if (query.category) actions = actions.filter((a) => getActionDef(a).category === query.category);
  if (query.action) actions = actions.filter((a) => a === query.action);

  const rows = await AuditLog.exportRows({ ...query, actions });
  const formatted = rows.map((entry) => formatAuditEntry(entry));

  await logAction(req, {
    action: 'admin.audit_log.exported',
    targetType: 'system',
    details: {
      rowCount: formatted.length,
      filters: auditFilters(query),
      capped: formatted.length >= AuditLog.EXPORT_MAX_ROWS,
    },
  });

  const lines = [CSV_COLUMNS.join(',')];
  for (const row of formatted) {
    const cells = { ...row, details: row.fields.map((f) => `${f.label}: ${f.value}`).join('; ') };
    lines.push(CSV_COLUMNS.map((c) => csvCell(cells[c])).join(','));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-log-${stamp}.csv"`);
  return res.send(lines.join('\n'));
});

// GET /api/admin/audit-logs/meta
const getAuditMeta = asyncHandler(async (req, res) => {
  const actions = Object.keys(AUDIT_ACTIONS).map((action) => {
    const def = AUDIT_ACTIONS[action];
    return {
      action,
      label: def.label,
      category: def.category,
      severity: def.severity,
      targetType: def.targetType,
    };
  });

  return sendSuccess(res, {
    data: {
      severities: SEVERITIES,
      categories: CATEGORIES.filter((category) =>
        actions.some((entry) => entry.category === category),
      ),
      actions,
    },
  });
});

module.exports = {
  listAuditLogs,
  listAuditNotes,
  addAuditNote,
  holdAuditLog,
  releaseAuditHold,
  exportAuditLogs,
  getAuditMeta,
};
