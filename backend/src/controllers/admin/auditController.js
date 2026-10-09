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
  canViewAction,
  visibleActionsFor,
  formatAuditEntry,
} = require('../../utils/audit-logs/actions');

// ===========================================================================
// Audit log
// ===========================================================================

/**
 * GET /api/admin/audit-logs
 *
 * The same endpoint for both roles; the role decides what comes back.
 *
 *   - WHICH ROWS: the query matches only actions whose registry audience the
 *     viewer meets. Filtering in the query rather than after it is what keeps
 *     `total` and the page size honest -- post-filtering returns short pages
 *     and a count that includes rows the viewer never saw.
 *   - WHICH FIELDS: formatAuditEntry redacts per row. An admin gets the
 *     summary sentence and the names of changed fields; a superadmin gets the
 *     detail sentence, the before/after values, the IP and the user agent.
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
async function annotate(rows, viewerRole, heldCopies = new Set()) {
  const ids = rows.map((r) => String(r._id));
  const [held, notes] = await Promise.all([AuditHold.heldIds(ids), AuditNote.countsFor(ids)]);
  return rows.map((entry) => {
    const id = String(entry._id);
    return {
      ...formatAuditEntry(entry, viewerRole),
      held: held.has(id),
      heldCopy: heldCopies.has(id),
      noteCount: notes[id] || 0,
    };
  });
}

// The row a note or hold is about: live, or its held copy once TTL took
// the original. A row the viewer may not see is treated as missing, so its
// existence isn't confirmed either
async function loadAuditRow(req) {
  const row = (await AuditLog.getById(req.params.id)) || (await AuditHold.getByAuditLogId(req.params.id))?.row;
  if (!row || !canViewAction(row.action, req.userRole)) throw ApiError.notFound('Audit entry not found');
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

// POST /api/admin/audit-logs/:id/hold -- superadmin only (adminRoutes)
const holdAuditLog = asyncHandler(async (req, res) => {
  const row = await AuditLog.getById(req.params.id);
  if (!row || !canViewAction(row.action, req.userRole)) throw ApiError.notFound('Audit entry not found');
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

// DELETE /api/admin/audit-logs/:id/hold -- superadmin only. If TTL already
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

// One "audit log viewed" row per admin per filter combination per 5 minutes,
// the same in-memory cooldown as the registration notice (authController).
// Refreshing or reopening the same view is one row; each different view
// (category, action, dates, held) writes its own. A search for one person
// (subjectId) always writes its own row: who looked someone up is the read
// worth keeping. Resets on restart, which only means one extra row
const AUDIT_VIEW_COOLDOWN_MS = 5 * 60 * 1000;
const lastAuditViewAt = new Map();

function auditViewDue(userId, query) {
  if (query.subjectId) return true;
  const key = `${userId}:${JSON.stringify(auditFilters(query))}`;
  const last = lastAuditViewAt.get(key);
  if (last && Date.now() - last < AUDIT_VIEW_COOLDOWN_MS) return false;
  if (lastAuditViewAt.size > 5000) lastAuditViewAt.clear();
  lastAuditViewAt.set(key, Date.now());
  return true;
}

const listAuditLogs = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || {};
  const viewerRole = req.userRole;

  // The allow-list. Everything downstream narrows this; nothing widens it.
  let actions = visibleActionsFor(viewerRole);

  if (query.category) {
    actions = actions.filter((action) => getActionDef(action).category === query.category);
  }

  if (query.action) {
    // Intersected with the allow-list rather than used directly, so asking for
    // a superadmin-only action as an admin returns nothing instead of leaking
    // it. An unknown or forbidden action leaves `actions` empty, and an empty
    // $in matches no documents -- which is the correct, quiet answer.
    actions = actions.filter((action) => action === query.action);
  }

  const result = query.held === 'true'
    ? await listHeld(actions, query)
    : await AuditLog.list({
      actions,
      subjectId: query.subjectId,
      subjectMode: query.subjectMode,
      from: query.from,
      to: query.to,
      page: query.page,
      limit: query.limit,
    });

  // Page 1 only, and once per admin per filter set per AUDIT_VIEW_COOLDOWN_MS
  // (auditViewDue), so reloading the same view is one row, not twenty
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
      rows: await annotate(result.rows, viewerRole, result.heldCopies),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pageCount: result.pageCount,
      },
      viewerRole,
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
// GET /api/admin/audit-logs/export -- CSV, superadmin only, so every row is
// formatted unredacted. Same filters as the table
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
  let actions = visibleActionsFor(req.userRole);
  if (query.category) actions = actions.filter((a) => getActionDef(a).category === query.category);
  if (query.action) actions = actions.filter((a) => a === query.action);

  const rows = await AuditLog.exportRows({ ...query, actions });
  const formatted = rows.map((entry) => formatAuditEntry(entry, req.userRole));

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
  const viewerRole = req.userRole;

  const actions = visibleActionsFor(viewerRole).map((action) => {
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
      viewerRole,
      severities: SEVERITIES,
      // Only categories the viewer can actually see anything in, so an admin
      // is not offered a "system" filter that can only ever return nothing.
      categories: CATEGORIES.filter((category) =>
        actions.some((entry) => entry.category === category),
      ),
      actions,
      // Lets the client label the redaction it is seeing ("IP address and
      // changed values are visible to superadmins") rather than silently
      // rendering blank columns, which reads as a bug.
      redacted: viewerRole !== 'superadmin',
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
