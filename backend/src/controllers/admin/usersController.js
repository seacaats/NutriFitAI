const User = require('../../models/user/User');
const { ROLES } = require('../../middleware/authMiddleware');
const { deleteUserAccount } = require('../../services/userDeletion');
const { sendSuccess, ApiError, asyncHandler } = require('../../utils/httpResponse');
const { logAction, diffFields } = require('../../utils/audit-logs/auditLogger');
const { notify } = require('../../services/notifications/notify');

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
    suspendedAt: user.suspendedAt || null,
    suspendedReason: user.suspendedReason || null,
    passwordResetRequired: Boolean(user.passwordResetRequiredAt),
  };
}

// The account an admin action is aimed at, or the reason it can't be.
// Nobody acts on themselves, and only on a strictly lower role: an admin on
// users, a superadmin on users and admins
async function loadManageableTarget(req) {
  if (req.params.id === req.userId) {
    throw ApiError.forbidden("You can't do this to your own account.", { code: 'SELF_ACTION' });
  }
  const target = await User.getByIdSafe(req.params.id);
  if (!target) throw ApiError.notFound('User not found');

  if (ROLES.indexOf(req.userRole) <= ROLES.indexOf(target.role || 'user')) {
    throw ApiError.forbidden('You can only act on accounts below your own role.', { code: 'INSUFFICIENT_ROLE' });
  }
  return target;
}

function targetEntry(target) {
  return {
    targetType: 'user',
    targetId: target.id,
    targetLabel: target.fullName || target.email,
    targetRole: target.role || 'user',
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
  const user = await User.getByIdSafe(req.params.id);
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
    throw ApiError.forbidden("You can't change your own role.", {
      code: 'SELF_ROLE_CHANGE',
    });
  }

  const target = await User.getByIdSafe(targetId);
  if (!target) throw ApiError.notFound('User not found');

  const currentRole = target.role || 'user';

  // Only admins and superadmins have a role to change. A user's isn't touched
  // from here
  if (currentRole === 'user') {
    throw ApiError.badRequest("Only admins and superadmins can have their role changed.", {
      code: 'USER_ROLE_PROTECTED',
    });
  }

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
   *    recovery (scripts/create-admins.js, which creates a new superadmin
   *    out of band) already exists for the case where it somehow happens.
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
  // Not awaited: notify never throws, and an email mustn't slow the response
  notify(targetId, 'role_changed');

  return sendSuccess(res, {
    message: `Role updated to ${nextRole}`,
    data: toUserRow(updated),
  });
});

// PATCH /api/admin/users/:id/profile -- names only (adminProfileSchema)
const updateUserProfile = asyncHandler(async (req, res) => {
  const target = await loadManageableTarget(req);
  const { reason, ...body } = req.body;

  const firstName = body.firstName !== undefined ? body.firstName : target.firstName;
  const lastName = body.lastName !== undefined ? body.lastName : target.lastName;
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;

  const changes = diffFields(['firstName', 'lastName'], target, { firstName, lastName });
  if (changes.length === 0) {
    throw ApiError.badRequest('Nothing changed', { code: 'NO_CHANGES' });
  }

  await User.updateNames(target.id, { fullName, firstName, lastName });
  await logAction(req, {
    action: 'admin.user.profile_updated',
    ...targetEntry(target),
    details: { changes, reason },
  });
  notify(target.id, 'name_changed_by_admin');

  const updated = await User.getByIdSafe(target.id);
  return sendSuccess(res, { message: 'Profile updated', data: toUserRow(updated) });
});

// POST /api/admin/users/:id/suspend
const suspendUser = asyncHandler(async (req, res) => {
  const target = await loadManageableTarget(req);
  if (target.suspendedAt) {
    throw ApiError.badRequest('That account is already suspended.', { code: 'ALREADY_SUSPENDED' });
  }

  const updated = await User.setSuspension(target.id, req.body.reason);
  await logAction(req, {
    action: 'admin.user.suspended',
    ...targetEntry(target),
    details: { reason: req.body.reason },
  });
  notify(target.id, 'account_suspended');

  return sendSuccess(res, { message: 'Account suspended', data: toUserRow(updated) });
});

// POST /api/admin/users/:id/reinstate
const reinstateUser = asyncHandler(async (req, res) => {
  const target = await loadManageableTarget(req);
  if (!target.suspendedAt) {
    throw ApiError.badRequest("That account isn't suspended.", { code: 'NOT_SUSPENDED' });
  }

  const updated = await User.setSuspension(target.id, null);
  await logAction(req, {
    action: 'admin.user.reinstated',
    ...targetEntry(target),
    details: { reason: req.body.reason },
  });
  notify(target.id, 'account_reinstated');

  return sendSuccess(res, { message: 'Account reinstated', data: toUserRow(updated) });
});

// POST /api/admin/users/:id/password-reset -- sign-in is refused until the
// user sets a new password through Forgot password
const forcePasswordReset = asyncHandler(async (req, res) => {
  const target = await loadManageableTarget(req);
  // getByIdSafe leaves the hash out, so whether there is one is read here
  if (!(await User.getById(target.id))?.passwordHash) {
    throw ApiError.badRequest('This account signs in with Google and has no password.', { code: 'NO_PASSWORD' });
  }

  const updated = await User.requirePasswordReset(target.id);
  await logAction(req, {
    action: 'admin.user.password_reset_forced',
    ...targetEntry(target),
    details: { reason: req.body.reason },
  });
  notify(target.id, 'password_reset_required');

  return sendSuccess(res, { message: 'Password reset required on next sign-in', data: toUserRow(updated) });
});

// POST /api/admin/users/:id/password-reset/cancel -- takes back a forced
// reset, e.g. one sent to the wrong account. The current password works again
const cancelPasswordReset = asyncHandler(async (req, res) => {
  const target = await loadManageableTarget(req);
  if (!target.passwordResetRequiredAt) {
    throw ApiError.badRequest('That account has no password reset pending.', { code: 'NO_RESET_PENDING' });
  }

  const updated = await User.cancelPasswordReset(target.id);
  await logAction(req, {
    action: 'admin.user.password_reset_cancelled',
    ...targetEntry(target),
    details: { reason: req.body.reason },
  });
  notify(target.id, 'password_reset_cancelled');

  return sendSuccess(res, { message: 'Password reset cancelled', data: toUserRow(updated) });
});

// DELETE /api/admin/users/:id -- superadmin only (adminRoutes)
const deleteUser = asyncHandler(async (req, res) => {
  const target = await loadManageableTarget(req);
  const deletedCounts = await deleteUserAccount(target.id);

  await logAction(req, {
    action: 'admin.user.deleted',
    ...targetEntry(target),
    details: { deletedCounts, reason: req.body.reason },
  });
  // The account is gone, so the address comes from the record read before
  notify(null, 'account_deleted', { email: target.email });

  return sendSuccess(res, { message: 'Account deleted', data: { id: target.id } });
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

module.exports = {
  listUsers,
  getUser,
  updateUserRole,
  updateUserProfile,
  suspendUser,
  reinstateUser,
  forcePasswordReset,
  cancelPasswordReset,
  deleteUser,
  listAdmins,
};