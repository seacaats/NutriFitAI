const crypto = require('crypto');
const User = require('../../models/user/User');
const Session = require('../../models/auth/Session');
const { hashPassword } = require('../../utils/auth/password');
const { DELETION_GRACE_DAYS } = require('../../services/user/accountDeletion');
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
    emailChangedAt: user.emailChangedAt || null,
    suspendedAt: user.suspendedAt || null,
    suspendedReason: user.suspendedReason || null,
    suspendedBy: user.suspendedBy || null,
    deletionScheduledFor: user.deletionScheduledFor || null,
    passwordResetRequired: Boolean(user.passwordResetRequiredAt),
    passwordResetRequiredAt: user.passwordResetRequiredAt || null,
    passwordResetReason: user.passwordResetRequiredReason || null,
    passwordResetBy: user.passwordResetRequiredBy || null,
  };
}

// The account an admin action is aimed at, or the reason it can't be.
// Nobody acts on themselves
async function loadManageableTarget(req) {
  if (req.params.id === req.userId) {
    throw ApiError.forbidden("You can't do this to your own account.", { code: 'SELF_ACTION' });
  }
  const target = await User.getByIdSafe(req.params.id);
  if (!target) throw ApiError.notFound('User not found');
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
   * Reading a user's record is itself audited (`admin.user.viewed`). Not paranoia: this endpoint returns another
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
      // already established as admin on a route that records the read.
      profile: user.profile || null,
      goals: user.goals || [],
    },
  });
});

// POST /api/admin/users -- adds a regular or admin account. No password is set or shown:
// the account is created locked (passwordResetRequiredAt) with a throwaway hash, and
// the person chooses their own through Forgot password, whose emailed code proves
// the address is theirs. An admin sets up 2FA at their first sign-in
const createUser = asyncHandler(async (req, res) => {
  const { reason, email, firstName, lastName, role = 'user' } = req.body;

  if (await User.findByEmail(email)) {
    throw ApiError.conflict('An account with that email already exists.', { code: 'EMAIL_TAKEN' });
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;
  const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));

  let created;
  try {
    created = await User.createAccount({
      email,
      passwordHash,
      fullName,
      firstName,
      lastName: lastName || null,
      emailVerifiedAt: new Date(),
      passwordResetRequiredAt: new Date(),
    });
    // Role is written after the insert; updateRole also turns 2FA on
    if (role === 'admin') created = await User.updateRole(created.id, role);
  } catch (err) {
    // Someone registered the same address a moment ago
    if (err?.code === 11000) throw ApiError.conflict('An account with that email already exists.', { code: 'EMAIL_TAKEN' });
    throw err;
  }

  const isAdmin = role === 'admin';
  await logAction(req, {
    action: isAdmin ? 'admin.admin.created' : 'admin.user.created',
    ...targetEntry(created),
    targetLabel: fullName || created.email,
    details: isAdmin ? { fromRole: 'none (account created)', toRole: role, reason } : { reason },
  });
  notify(null, 'account_invited', { email: created.email });

  return sendSuccess(res, { statusCode: 201, message: 'Account created. An email tells them how to set a password.', data: toUserRow(created) });
});

// GET /api/admin/users/:id/sessions -- the devices signed in right now
const listUserSessions = asyncHandler(async (req, res) => {
  const target = await User.getByIdSafe(req.params.id);
  if (!target) throw ApiError.notFound('User not found');

  const rows = await Session.listLive(target.id);
  return sendSuccess(res, {
    data: rows.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      ip: s.ip || null,
      userAgent: s.userAgent || null,
    })),
  });
});

// DELETE /api/admin/users/:id/sessions/:sid
// Admins are cut off at once (requireFreshRole), regular users at their next refresh
const revokeUserSession = asyncHandler(async (req, res) => {
  const target = await loadManageableTarget(req);

  if (!(await Session.revoke(target.id, req.params.sid, req.userId))) {
    throw ApiError.notFound('Session not found');
  }
  await logAction(req, {
    action: 'admin.user.session_revoked',
    ...targetEntry(target),
    details: { reason: req.body.reason },
  });

  return sendSuccess(res, { message: 'Session ended' });
});

// DELETE /api/admin/users/:id/sessions -- every device
const revokeAllUserSessions = asyncHandler(async (req, res) => {
  const target = await loadManageableTarget(req);

  const count = await Session.revokeAll(target.id, req.userId);
  await logAction(req, {
    action: 'admin.user.sessions_revoked',
    ...targetEntry(target),
    details: { count, reason: req.body.reason },
  });
  if (count > 0) notify(target.id, 'signed_out_by_admin');

  return sendSuccess(res, { message: count ? `Signed out of ${count} ${count === 1 ? 'device' : 'devices'}` : 'No active sessions', data: { count } });
});

// POST /api/admin/users/:id/authenticator-reset -- for an admin who lost their device. The
// authenticator and recovery codes are cleared and every session ended: at their next
// sign-in they scan a new app and get fresh codes
const resetUserAuthenticator = asyncHandler(async (req, res) => {
  const target = await loadManageableTarget(req);
  if (target.role !== 'admin') {
    throw ApiError.badRequest('Only admin accounts have an authenticator app.', { code: 'NOT_ADMIN' });
  }

  // The secret is left out of the safe read, so this asks for the full record
  const full = await User.getById(target.id);
  if (!full.mfa || !full.mfa.secretEnc) {
    throw ApiError.badRequest("That admin hasn't set up an authenticator app yet.", { code: 'MFA_NOT_SET_UP' });
  }

  const updated = await User.resetAuthenticator(target.id);
  await Session.revokeAll(target.id, req.userId);
  await logAction(req, {
    action: 'admin.user.authenticator_reset',
    ...targetEntry(target),
    details: { reason: req.body.reason },
  });
  notify(target.id, 'mfa_reset_by_admin');

  return sendSuccess(res, { message: 'Authenticator reset. They set up a new one at their next sign-in.', data: toUserRow(updated) });
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

  const updated = await User.setSuspension(target.id, req.body.reason, User.displayName(req.user));
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
  if (target.deletionScheduledFor) {
    throw ApiError.badRequest('Cancel the scheduled deletion instead.', { code: 'DELETION_SCHEDULED' });
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

  const updated = await User.requirePasswordReset(target.id, { reason: req.body.reason, by: User.displayName(req.user) });
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

// DELETE /api/admin/users/:id -- doesn't delete yet: the account is suspended and signed
// out, then purged after DELETION_GRACE_DAYS unless an admin cancels (purgeDueDeletions)
const deleteUser = asyncHandler(async (req, res) => {
  const target = await loadManageableTarget(req);
  if (target.deletionScheduledFor) {
    throw ApiError.badRequest('That account is already scheduled for deletion.', { code: 'ALREADY_SCHEDULED' });
  }

  const purgeAt = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const updated = await User.setDeletion(target.id, purgeAt, { reason: req.body.reason, by: User.displayName(req.user) });
  await Session.revokeAll(target.id, req.userId);

  await logAction(req, {
    action: 'admin.user.deletion_scheduled',
    ...targetEntry(target),
    details: { purgeAt: purgeAt.toISOString(), reason: req.body.reason },
  });
  notify(target.id, 'account_deletion_scheduled');

  return sendSuccess(res, { message: `Account suspended. It will be deleted in ${DELETION_GRACE_DAYS} days unless you cancel.`, data: toUserRow(updated) });
});

// POST /api/admin/users/:id/deletion/cancel -- takes the deletion back and reinstates the account
const cancelUserDeletion = asyncHandler(async (req, res) => {
  const target = await loadManageableTarget(req);
  if (!target.deletionScheduledFor) {
    throw ApiError.badRequest("That account isn't scheduled for deletion.", { code: 'NOT_SCHEDULED' });
  }

  const updated = await User.setDeletion(target.id, null);
  await logAction(req, {
    action: 'admin.user.deletion_cancelled',
    ...targetEntry(target),
    details: { reason: req.body.reason },
  });
  notify(target.id, 'account_deletion_cancelled');

  return sendSuccess(res, { message: 'Deletion cancelled', data: toUserRow(updated) });
});

module.exports = {
  listUsers,
  getUser,
  createUser,
  listUserSessions,
  revokeUserSession,
  revokeAllUserSessions,
  resetUserAuthenticator,
  updateUserProfile,
  suspendUser,
  reinstateUser,
  forcePasswordReset,
  cancelPasswordReset,
  deleteUser,
  cancelUserDeletion,
};