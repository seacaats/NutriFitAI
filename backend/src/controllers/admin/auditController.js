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

/**
 * GET /api/admin/audit-logs
 *
 * The query matches only registered actions. Filtering in the query rather
 * than after it is what keeps `total` and the page size honest --
 * post-filtering returns short pages and a count that includes rows the
 * viewer never saw. Each row carries its sentence, before/after values, IP
 * and user agent (formatAuditEntry).
 *
 * Note that the response carries no data today by design -- nothing writes
 * most of these actions yet. The endpoint returning a well-formed empty page
 * is the point: the table, its filters and its pagination are all exercised
 * against the real contract before the first producer lands.
 */
// The filters a view or an export ran with, stored on its audit row.
// subjectMode says which side of the user was looked at (actor, target,
// self); it only applies with a subjectId. null = not filtered on that
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

// The "Held" filter: held copies, newest hold first, narrowed by the same
// allow-list as the live log. heldCopies marks the ones whose original row
// TTL has already removed
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

// Formats a page and adds what the drawer needs beyond the row itself:
// whether it's held, whether it's a copy that outlived its row, its note count
async function annotate(rows, heldCopies = new Set()) {
  const ids = rows.map((r) => String(r._id));
  const [held, notes] = await Promise.all([AuditHold.heldMap(ids), AuditNote.countsFor(ids)]);
  return rows.map((entry) => {
    const id = String(entry._id);
    return {
      ...formatAuditEntry(entry),
      held: held.has(id),
      // Why and by whom, so the drawer can show the reason it was held
      hold: held.has(id)
        ? { reason: held.get(id).reason, by: held.get(id).heldByLabel, at: held.get(id).createdAt }
        : null,
      heldCopy: heldCopies.has(id),
      noteCount: notes[id] || 0,
    };
  });
}

// The row a note or hold is about: live, or its held copy once TTL took
// the original. A row whose action is no longer registered is treated as missing
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

// DELETE /api/admin/audit-logs/:id/hold -- if TTL already
// removed the original, releasing deletes the last copy for good
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

// One "audit log viewed" row per admin per 5 minutes, the same in-memory cooldown
// as the registration notice (authController). Browsing (switching tabs, categories,
// dates, held, noted) shares that one cooldown, so clicking around isn't a row per
// click; the row keeps the filters of the first view. Looking up one person
// (subjectId) has its own cooldown per person and side: who looked someone up is
// the read worth keeping. Resets on restart, which only means one extra row
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

const listAuditLogs = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || {};

  // The allow-list. Everything downstream narrows this; nothing widens it.
  let actions = Object.keys(AUDIT_ACTIONS);

  if (query.category) {
    actions = actions.filter((action) => getActionDef(action).category === query.category);
  }

  if (query.action) {
    // Intersected with the allow-list rather than used directly. An unknown
    // action leaves `actions` empty, and an empty $in matches no documents --
    // which is the correct, quiet answer.
    actions = actions.filter((action) => action === query.action);
  }

  const result = query.held === 'true'
    ? await listHeld(actions, query)
    : await AuditLog.list({
      actions,
      // "Noted": only the rows that have a note
      ids: query.noted === 'true' ? await AuditNote.notedIds() : undefined,
      subjectId: query.subjectId,
      subjectMode: query.subjectMode,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    });

  // Page 1 only, and once per admin per AUDIT_VIEW_COOLDOWN_MS (auditViewDue),
  // so reloading or switching tabs is one row, not twenty
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

/**
 * GET /api/admin/audit-logs/meta
 *
 * The filter menu's options, derived from the registry rather than from the
 * data. Deriving them from distinct values in the collection would mean an
 * empty collection renders an empty filter menu -- exactly the state the table
 * is in right now, and exactly when being able to see the catalogue is most
 * useful. It also lets the client render the severity legend and the action
 * labels without shipping a second copy of the registry.
 */
// GET /api/admin/audit-logs/export -- CSV. Same filters as the table
const CSV_COLUMNS = [
  'createdAt', 'action', 'label', 'category', 'severity', 'message', 'details', 'actor', 'actorId',
  'actorRole', 'target', 'targetId', 'targetType', 'ipAddress', 'userAgent',
];

// Quotes every cell, and defuses spreadsheet formulas (=, +, -, @)
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
    // The drawer's fields as "Label: value; ...". Instants stay ISO, a
    // spreadsheet reads those directly
    const cells = { ...row, details: row.fields.map((f) => `${f.label}: ${f.value}`).join('; ') };
    lines.push(CSV_COLUMNS.map((c) => csvCell(cells[c])).join(','));
  }

  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-log-${stamp}.csv"`);
  return res.send(lines.join('\n'));
});

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
      // Only categories that have at least one action, so the filter menu
      // is never offered one that can only ever return nothing.
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