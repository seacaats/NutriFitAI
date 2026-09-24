const User = require('../models/user/User');
const AuditLog = require('../models/AuditLog');
const { sendSuccess, ApiError, asyncHandler } = require('../utils/httpResponse');
const { logAction } = require('../utils/auditLogger');
const {
  AUDIT_ACTIONS,
  CATEGORIES,
  SEVERITIES,
  getActionDef,
  canViewAction,
  visibleActionsFor,
  formatAuditEntry,
} = require('../utils/auditActions');

/**
 * The admin and superadmin surface.
 *
 * ONE CONTROLLER, TWO AUDIENCES
 * -----------------------------
 * There is no separate superadminController, and that is deliberate. Every
 * endpoint here differs between the two roles by DEGREE -- more rows, more
 * columns, more actions -- not by kind, and splitting them would mean two
 * copies of the same query with the redaction rules drifting apart. Instead
 * the viewer's role is read once per request from req.userRole (refreshed
 * against the database by requireFreshRole, not trusted from the token) and
 * threaded into the two places that care: which actions the query matches,
 * and how each row is formatted.
 *
 * The rule that keeps that safe: a caller can never widen what they see. Every
 * visibility decision reads req.userRole; nothing reads the query string.
 */

/** The shape the users table renders. Never includes passwordHash -- the model
 *  strips it at its own boundary -- and deliberately not the profile subdocument
 *  either: a directory listing has no business carrying everyone's health
 *  conditions, and the detail endpoint is where a single user's profile lives. */

//
function toUserRow(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role || 'user',
    emailVerified: Boolean(user.emailVerifiedAt),
    termsAcceptedAt: user.termsAcceptedAt || null,
    createdAt: user.createdAt,
  };
}


// USERS

// GET /api/admin/users
const listUsers = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || {};

  const [page, counts] = await Promise.all([
    User.listPaginated(query),
    User.countByRole(),
  ]);

  return sendSuccess(res, {
    data: {
      rows: page.rows.map(toUserRow),
      pagination: {
        page: page.page,
        limit: page.limit,
        total: page.total,
        pageCount: page.pageCount,
      },
      counts: {
        user: counts.user || 0,
        admin: counts.admin || 0,
        superadmin: counts.superadmin || 0,
        total: Object.values(counts).reduce((sum, n) => sum + n, 0),
      },
    },
  });
});

// GET /api/admin/users/:id
const getUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdSafe(req.params.id);
  if (!user) throw ApiError.notFound('User not found');

  /**
   * Reading a user's record is itself audited (`admin.user.viewed`, visible
   * only to a superadmin). Not paranoia: this endpoint returns another
   * person's email, profile and goal history, and an audit trail that records
   * every write but no read cannot answer "who looked at this account".
   *
   * Awaited rather than fired and forgotten because logAction already swallows
   * its own failures -- an unawaited promise here would only add an
   * unhandled-rejection path for no latency win worth having.
   */
  await logAction(req, {
    action: 'admin.user.viewed',
    targetType: 'user',
    targetId: user.id,
    targetLabel: user.fullName || user.email,
  });

  return sendSuccess(res, {
    data: {
      ...toUserRow(user),
      // The detail view is the one place the profile is exposed, to a caller
      // already established as admin-or-above on a route that records the read.
      profile: user.profile || null,
      goals: user.goals || [],
    },
  });
});

/**
 * PATCH /api/admin/users/:id/role   (superadmin only)
 *
 * The four guards below are the whole of the authorization model for role
 * changes, and each closes a distinct hole:
 */
const updateUserRole = asyncHandler(async (req, res) => {
  const { role: nextRole, reason } = req.body;
  const targetId = req.params.id;

  // 1. Self-demotion, and more importantly self-PROMOTION. Without this an
  //    admin who somehow reached this route could grant themselves superadmin;
  //    with it, privilege only ever flows from another account, so there is
  //    always a second party in the trail.
  if (targetId === req.userId) {
    throw ApiError.forbidden('You cannot change your own role', {
      code: 'SELF_ROLE_CHANGE',
    });
  }

  const target = await User.findByIdSafe(targetId);
  if (!target) throw ApiError.notFound('User not found');

  const currentRole = target.role || 'user';

  // 2. A no-op write would still produce a critical-severity audit entry,
  //    which is how an audit trail becomes noise nobody reads.
  if (currentRole === nextRole) {
    throw ApiError.badRequest(`That user is already a ${nextRole}`, {
      code: 'ROLE_UNCHANGED',
    });
  }

  /**
   * 3. Do not strand the system without a superadmin.
   *
   *    Demoting the last one leaves nobody who can promote anyone, and the
   *    only recovery is a database script -- which is a genuinely bad Sunday.
   *    The count is taken inside the request rather than cached because the
   *    answer must be current at the moment of the write.
   *
   *    This is a check, not a transaction: two concurrent demotions of the
   *    last two superadmins could both observe a count of 2 and both proceed.
   *    Accepted rather than wrapped in withTransaction, because the race needs
   *    two superadmins demoting each other in the same instant, and the
   *    recovery (the migration script's --grant-superadmin flag) already
   *    exists for the case where it somehow happens.
   */
  if (currentRole === 'superadmin' && nextRole !== 'superadmin') {
    const counts = await User.countByRole();
    if ((counts.superadmin || 0) <= 1) {
      throw ApiError.conflict(
        'This is the only superadmin. Promote another account before demoting this one.',
        { code: 'LAST_SUPERADMIN' },
      );
    }
  }

  const updated = await User.updateRole(targetId, nextRole);

  /**
   * 4. Which entry gets written depends on the transition, not just on the
   *    endpoint. A grant and a revocation are different events to anyone
   *    reading the trail, and folding both into one "role changed" row would
   *    make the most consequential action in the system unsearchable.
   *
   *    The role change is committed before this runs: logAction never throws,
   *    so a failure here loses the entry rather than the change. That is the
   *    documented trade in auditLogger -- an audit write must not be able to
   *    fail the action it describes.
   */
  const grantingPrivilege = nextRole !== 'user' && currentRole === 'user';
  const revokingPrivilege = nextRole === 'user' && currentRole !== 'user';

  const action = grantingPrivilege
    ? 'admin.admin.created'
    : revokingPrivilege
      ? 'admin.admin.revoked'
      : 'admin.user.role_changed';

  await logAction(req, {
    action,
    targetType: 'user',
    targetId,
    targetLabel: target.fullName || target.email,
    details: {
      // Both the flat pair the role templates read AND the standard changes[]
      // array, so this row renders correctly whether a future view formats it
      // via the specific template or the generic field-diff renderer.
      fromRole: currentRole,
      toRole: nextRole,
      changes: [{ field: 'role', from: currentRole, to: nextRole }],
      reason,
    },
  });

  return sendSuccess(res, {
    message: `Role updated to ${nextRole}`,
    data: toUserRow(updated),
  });
});

// ===========================================================================
// Admins  (superadmin only)
// ===========================================================================

/**
 * GET /api/admin/admins
 *
 * A filtered view of the same collection, not a separate one -- an admin is a
 * user with a role, so a distinct endpoint exists for the route guard and the
 * default filter, not for a different data source. The query is served by the
 * users_role_privileged partial index.
 */
const listAdmins = asyncHandler(async (req, res) => {
  const query = req.validatedQuery || {};

  const [admins, supers, counts] = await Promise.all([
    User.listPaginated({ ...query, role: 'admin' }),
    User.listPaginated({ ...query, role: 'superadmin', limit: 100 }),
    User.countByRole(),
  ]);

  return sendSuccess(res, {
    data: {
      // Superadmins first: there are few of them, they outrank everything
      // below, and burying them on page two of an alphabetical list would be
      // the wrong default for the one table where "who can do what" is the
      // entire question being asked.
      rows: [...supers.rows, ...admins.rows].map(toUserRow),
      pagination: {
        page: admins.page,
        limit: admins.limit,
        total: admins.total + supers.total,
        pageCount: admins.pageCount,
      },
      counts: {
        admin: counts.admin || 0,
        superadmin: counts.superadmin || 0,
      },
    },
  });
});

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

  const result = await AuditLog.list({
    actions,
    subjectId: query.subjectId,
    from: query.from,
    to: query.to,
    page: query.page,
    limit: query.limit,
  });

  return sendSuccess(res, {
    data: {
      rows: result.rows.map((entry) => formatAuditEntry(entry, viewerRole)),
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
  listUsers,
  getUser,
  updateUserRole,
  listAdmins,
  listAuditLogs,
  getAuditMeta,
  // Exported for the route layer's own sanity check that the registry and the
  // guard agree on who may see what.
  canViewAction,
};
