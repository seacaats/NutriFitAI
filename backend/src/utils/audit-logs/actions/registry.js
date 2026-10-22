/**
 * Audit action registry defining machine-readable action keys (<domain>.<entity>.<verb_past>),
 * categories, severities, retention periods, and display templates.
 *
 * Field-edit actions store changes as:
 *   details.changes = [{ field: 'email', from: 'a@x.com', to: 'b@x.com' }, ...]
 */

const RETENTION_DAYS = {
  info: 365,
  notice: 365,
  warning: 730,
  critical: 1095,
};

const NETWORK_CATEGORIES = ['auth', 'administration'];

// Sensitive health fields: record only the field name on change, never before/after values
const HEALTH_FIELDS = [
  'age',
  'heightCm',
  'weightKg',
  'targetWeightKg',
  'weeklyPaceKg',
];

const SEVERITIES = ['info', 'notice', 'warning', 'critical'];

const CATEGORIES = [
  'auth',
  'account',
  'activity',
  'nutrition',
  'workout',
  'coach',
  'notification',
  'administration',
  'system',
];

/**
 * @typedef {object} AuditActionDef
 * @property {boolean} [network]
 * @property {string} label
 * @property {string} category
 * @property {string} severity
 * @property {string|null} targetType
 * @property {string} message
 * @property {Array<{label: string, key?: string, value?: string, format?: string}>} fields
 */

/** @type {Record<string, AuditActionDef>} */
const AUDIT_ACTIONS = {
  // =========================================================================
  // auth -- sessions and credentials
  // =========================================================================
  'auth.register.completed': {
    label: 'Account created',
    category: 'auth',
    severity: 'info',
    targetType: 'user',
    message: '{actor} created an account',

    fields: [],
  },

  'auth.register.consent_accepted': {
    label: 'Terms accepted',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    message: '{actor} accepted the terms of service',

    fields: [
      { label: 'Diet preference given', key: 'providedDietPreference', format: 'yesno' },
      { label: 'Health conditions given', key: 'providedHealthConditions', format: 'yesno' },
      { label: 'Re-registration', key: 'reRegistration', format: 'yesno' },
    ],
  },

  'auth.email.verified': {
    label: 'Email verified',
    category: 'auth',
    severity: 'info',
    targetType: 'user',
    message: '{actor} verified their email',

    fields: [],
  },

  'auth.login.succeeded': {
    label: 'Signed in',
    category: 'auth',
    severity: 'info',
    targetType: 'user',
    message: '{actor} signed in',

    fields: [
      { label: 'Method', key: 'method', format: 'label' },
    ],
  },

  // Stores only details.emailHash (HMAC), never raw attempted email
  'auth.login.failed': {
    label: 'Sign-in failed',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    message: 'Sign-in failed for {target}',

    fields: [
      { label: 'Reason', key: 'reason', format: 'label' },
      { label: 'Email hash', key: 'emailHash' },
    ],
  },

  'auth.mfa.enabled': {
    label: 'Two-factor turned on',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    message: '{actor} turned on two-factor sign-in',

    fields: [],
  },

  'auth.mfa.disabled': {
    label: 'Two-factor turned off',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    message: '{actor} turned off two-factor sign-in',

    fields: [],
  },

  'auth.mfa.recovery_regenerated': {
    label: 'Recovery codes regenerated',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    message: '{actor} generated new recovery codes',

    fields: [],
  },

  'auth.email.change_requested': {
    label: 'Email change requested',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    message: '{actor} asked to change their email',

    fields: [],
  },

  'auth.email.changed': {
    label: 'Email changed',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    message: '{actor} changed their email',

    fields: [],
  },

  'auth.mfa.recovery_used': {
    label: 'Recovery code used',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    message: '{actor} signed in with a recovery code',

    fields: [],
  },

  'auth.mfa.failed': {
    label: 'Two-factor code rejected',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    message: 'A wrong two-factor code was entered for {target}',

    fields: [
      { label: 'Step', key: 'step', format: 'label' },
    ],
  },

  'auth.mfa.locked': {
    label: 'Two-factor locked',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    message: 'Two-factor sign-in was locked for {target}',

    fields: [],
  },

  'auth.logout': {
    label: 'Signed out',
    category: 'auth',
    severity: 'info',
    targetType: 'user',
    message: '{actor} signed out',

    fields: [],
  },

  'auth.password.reset_requested': {
    label: 'Password reset requested',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    message: '{actor} requested a password reset',

    fields: [],
  },

  'auth.password.reset_completed': {
    label: 'Password changed',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    message: '{actor} reset their password',

    fields: [],
  },

  'auth.password.changed': {
    label: 'Password changed',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    message: '{actor} changed their password',

    fields: [
      { label: 'Where', value: 'Settings' },
    ],
  },

  'auth.oauth.linked': {
    label: 'Social account linked',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    message: '{actor} linked their {provider} account',

    fields: [],
  },

  'auth.token.refresh_rejected': {
    label: 'Session refresh rejected',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    message: 'Session refresh rejected for {target}',

    fields: [
      { label: 'Reason', key: 'reason', format: 'label' },
    ],
  },

  'auth.otp.resent': {
    label: 'Verification code resent',
    category: 'auth',
    severity: 'info',
    targetType: 'user',
    message: 'Verification code resent to {actor}',

    fields: [],
  },

  'auth.password.reset_otp_verified': {
    label: 'Reset code verified',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    message: '{actor} entered their reset code',

    fields: [],
  },

  // Recorded once per key per rate-limit window
  'auth.login.rate_limited': {
    label: 'Rate limit hit',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    message: 'Too many {limiter} attempts',

    fields: [
      { label: 'Email hash', key: 'emailHash' },
    ],
  },

  'auth.password.verify_failed': {
    label: 'Password check failed',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    message: '{actor} entered a wrong current password',

    fields: [],
  },

  // =========================================================================
  // account -- the user acting on their own record
  // =========================================================================
  'account.profile.updated': {
    label: 'Profile updated',
    category: 'account',
    severity: 'info',
    targetType: 'user',
    message: '{actor} updated their profile',

    fields: [],
  },

  'account.setup.completed': {
    label: 'Setup completed',
    category: 'account',
    severity: 'info',
    targetType: 'user',
    message: '{actor} finished setting up their account',

    fields: [
      { label: 'Skipped', key: 'skipped', format: 'yesno' },
    ],
  },

  'account.avatar.updated': {
    label: 'Photo updated',
    category: 'account',
    severity: 'info',
    targetType: 'user',
    message: '{actor} changed their profile photo',

    fields: [],
  },

  'account.avatar.removed': {
    label: 'Photo removed',
    category: 'account',
    severity: 'info',
    targetType: 'user',
    message: '{actor} removed their profile photo',

    fields: [],
  },

  'account.goal.changed': {
    label: 'Goal changed',
    category: 'account',
    severity: 'info',
    targetType: 'user',
    message: '{actor} changed their goal to {fitnessGoal}',

    fields: [
      { label: 'Previous goal', key: 'previousGoal', format: 'label' },
      { label: 'Effective', key: 'effectiveFrom', format: 'day' },
    ],
  },

  'account.deleted': {
    network: true,
    label: 'Account deleted',
    category: 'account',
    severity: 'critical',
    targetType: 'user',
    message: '{actor} deleted their account',

    fields: [
      { label: 'Removed', key: 'deletedCounts', format: 'counts' },
    ],
  },

  // =========================================================================
  // daily steps
  // =========================================================================
  'activity.steps.source_changed': {
    label: 'Step source changed',
    category: 'activity',
    severity: 'info',
    targetType: 'user',
    message: '{actor} connected {source}',

    fields: [
      { label: 'Previous', key: 'previousSource', format: 'label' },
    ],
  },

  'activity.steps.permission_revoked': {
    label: 'Step permission revoked',
    category: 'activity',
    severity: 'notice',
    targetType: 'user',
    message: '{actor} disconnected {previousSource}',

    fields: [],
  },

  // =========================================================================
  // food scanner and meals
  // =========================================================================
  'nutrition.scan.failed': {
    label: 'Food scan failed',
    category: 'nutrition',
    severity: 'warning',
    targetType: 'food_scan',
    message: "{actor}'s food scan failed",
    fields: [
      { label: 'Reason', key: 'reason' },
      { label: 'Stage', key: 'stage', format: 'label' },
      { label: 'Scan ID', key: 'targetId' },
    ],
  },

  // =========================================================================
  // workout
  // =========================================================================
  'workout.catalog.synced': {
    label: 'Exercise catalog synced',
    category: 'workout',
    severity: 'notice',
    targetType: 'system',
    message: 'Exercise catalog synced',

    fields: [
      { label: 'Added', key: 'added' },
      { label: 'Updated', key: 'updated' },
      { label: 'Skipped', key: 'skipped' },
      { label: 'Pruned', key: 'pruned' },
    ],
  },

  // =========================================================================
  // coach -- AI chat
  // =========================================================================
  'coach.provider.failover': {
    label: 'AI provider failover',
    category: 'coach',
    severity: 'warning',
    targetType: 'system',
    message: 'AI coach switched from {fromProvider} to {toProvider}',

    fields: [
      { label: 'Reason', key: 'reason', format: 'label' },
      { label: 'HTTP status', key: 'status' },
    ],
  },

  'coach.quota.exhausted': {
    label: 'AI quota exhausted',
    category: 'coach',
    severity: 'warning',
    targetType: 'system',
    message: "{provider}'s quota ran out",
    fields: [
      { label: 'Limit', key: 'limitKind', format: 'label' },
      { label: 'Resumes', key: 'resumesAt', format: 'datetime' },
    ],
  },

  'coach.embeddings.paused': {
    label: 'Semantic search paused',
    category: 'coach',
    severity: 'warning',
    targetType: 'system',
    message: 'Coach semantic search paused ({reason})',
    fields: [
      { label: 'HTTP status', key: 'status' },
      { label: 'Resumes', key: 'resumesAt', format: 'datetime' },
    ],
  },

  // =========================================================================
  // notification -- push preferences and delivery
  // =========================================================================
  'account.notifications.toggled': {
    label: 'Notification settings changed',
    category: 'notification',
    severity: 'info',
    targetType: 'user',
    message: '{actor} changed their notification settings',
    fields: [
      { label: 'Changes', key: 'summary' },
    ],
  },

  'account.push_token.registered': {
    label: 'Device registered',
    category: 'notification',
    severity: 'info',
    targetType: 'user',
    message: '{actor} registered a device for notifications',

    fields: [
      { label: 'Platform', key: 'platform', format: 'label' },
      { label: 'Token hash', key: 'tokenHash' },
    ],
  },

  'account.push_token.revoked': {
    label: 'Device unregistered',
    category: 'notification',
    severity: 'info',
    targetType: 'user',
    message: '{actor} unregistered a device from notifications',

    fields: [
      { label: 'Token hash', key: 'tokenHash' },
    ],
  },

  'notification.delivery.failed': {
    label: 'Notification failed',
    category: 'notification',
    severity: 'warning',
    targetType: 'user',
    message: 'A notification to {target} failed',

    fields: [
      { label: 'Kind', key: 'kind', format: 'label' },
      { label: 'Reason', key: 'reason' },
      { label: 'Token hash', key: 'tokenHash' },
    ],
  },

  'notification.push_token.invalidated': {
    label: 'Device token invalidated',
    category: 'notification',
    severity: 'notice',
    targetType: 'user',
    message: 'A device token for {target} was invalidated',

    fields: [
      { label: 'Token hash', key: 'tokenHash' },
    ],
  },

  // =========================================================================
  // administration -- privileged actions on user accounts and audit logs
  // =========================================================================
  'admin.user.viewed': {
    label: 'User record viewed',
    category: 'administration',
    severity: 'notice',
    targetType: 'user',
    message: "{actor} viewed {target}'s account",
    fields: [],
  },

  'admin.user.profile_updated': {
    label: 'User profile edited',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    message: '{actor} renamed {target}',

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.suspended': {
    label: 'User suspended',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    message: '{actor} suspended {target}',

    fields: [
      { label: 'Reason', key: 'reason' },
      { label: 'Message to user', key: 'userMessage' },
    ],
  },

  'admin.user.reinstated': {
    label: 'User reinstated',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    message: '{actor} reinstated {target}',

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.deleted': {
    label: 'User deleted',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    message: "{actor} deleted {target}'s account",
    fields: [
      { label: 'Removed', key: 'deletedCounts', format: 'counts' },
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.deletion_scheduled': {
    label: 'Deletion scheduled',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    message: '{actor} scheduled {target} for deletion',
    fields: [
      { label: 'Deleted on', key: 'purgeAt' },
      { label: 'Reason', key: 'reason' },
      { label: 'Message to user', key: 'userMessage' },
    ],
  },

  'admin.user.deletion_cancelled': {
    label: 'Deletion cancelled',
    category: 'administration',
    severity: 'warning',
    targetType: 'user',
    message: "{actor} cancelled {target}'s scheduled deletion",
    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.password_reset_forced': {
    label: 'Password reset forced',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    message: '{actor} required {target} to reset their password',

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.created': {
    label: 'Account created',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    message: '{actor} created the account for {target}',

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.session_revoked': {
    label: 'Session ended',
    category: 'administration',
    severity: 'warning',
    targetType: 'user',
    message: '{actor} ended a session of {target}',

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.sessions_revoked': {
    label: 'All sessions ended',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    message: '{actor} signed {target} out of every device',

    fields: [
      { label: 'Sessions ended', key: 'count' },
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.recovery_regenerated': {
    label: 'Recovery codes regenerated',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    message: '{actor} generated new recovery codes for {target}',

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.authenticator_reset': {
    label: 'Authenticator reset',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    message: "{actor} reset {target}'s authenticator app",

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.password_reset_cancelled': {
    label: 'Password reset cancelled',
    category: 'administration',
    severity: 'warning',
    targetType: 'user',
    message: '{actor} cancelled the password reset for {target}',

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.image.viewed': {
    label: 'Flagged photo viewed',
    category: 'administration',
    severity: 'notice',
    targetType: 'user',
    message: "{actor} viewed a flagged photo from {target}",

    fields: [
      { label: 'Photo', key: 'kind', format: 'label' },
    ],
  },

  'admin.image.approved': {
    label: 'Flagged photo approved',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    message: "{actor} approved a flagged photo from {target}",

    fields: [
      { label: 'Photo', key: 'kind', format: 'label' },
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.image.removed': {
    label: 'Photo removed',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    message: "{actor} removed a photo from {target}",

    fields: [
      { label: 'Photo', key: 'kind', format: 'label' },
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.admin.created': {
    label: 'Admin granted',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    message: '{actor} gave {target} {toRole} access',

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.audit_log.held': {
    label: 'Audit entry held',
    category: 'administration',
    severity: 'critical',
    targetType: 'system',
    message: '{actor} put an audit entry on hold',
    fields: [
      { label: 'Entry', key: 'heldAction', format: 'action' },
      { label: 'Reason', key: 'reason' },
      { label: 'Entry ID', key: 'auditLogId' },
    ],
  },

  'admin.audit_log.hold_released': {
    label: 'Audit hold released',
    category: 'administration',
    severity: 'critical',
    targetType: 'system',
    message: "{actor} released an audit entry's hold",
    fields: [
      { label: 'Entry', key: 'heldAction', format: 'action' },
      { label: 'Reason', key: 'reason' },
      { label: 'Entry ID', key: 'auditLogId' },
    ],
  },

  'admin.audit_log.note_added': {
    label: 'Audit note added',
    category: 'administration',
    severity: 'notice',
    targetType: 'system',
    message: '{actor} added a note to an audit entry',
    fields: [
      { label: 'Entry', key: 'notedAction', format: 'action' },
      { label: 'Entry ID', key: 'auditLogId' },
    ],
  },

  'admin.audit_log.viewed': {
    label: 'Audit log viewed',
    category: 'administration',
    severity: 'notice',
    targetType: 'system',
    message: '{actor} viewed the audit log',

    fields: [
      { label: 'Filters', key: 'filters', format: 'exportFilters' },
    ],
  },

  'admin.audit_log.exported': {
    label: 'Audit log exported',
    category: 'administration',
    severity: 'critical',
    targetType: 'system',
    message: '{actor} exported {rowCount} audit entries',

    fields: [
      { label: 'Filters', key: 'filters', format: 'exportFilters' },
      { label: 'Capped at the export limit', key: 'capped', format: 'yesno' },
    ],
  },

  // =========================================================================
  // system -- automated jobs and integrity checks
  // =========================================================================
  'system.retention.scan_images_purged': {
    label: 'Retention job ran',
    category: 'system',
    severity: 'info',
    targetType: 'system',
    message: 'Removed {purgedCount} food scan photos over {retentionDays} days old',

    fields: [],
  },

  'system.audit_chain.broken': {
    label: 'Audit chain broken',
    category: 'system',
    severity: 'critical',
    targetType: 'system',
    message: 'Audit log integrity check failed',

    fields: [
      { label: 'Entries', key: 'chain', format: 'label' },
      { label: 'Problem', key: 'reason', format: 'label' },
      { label: 'Row ID', key: 'brokenAt' },
    ],
  },

  // =========================================================================
  // moderation -- automated image moderation
  // =========================================================================
  'moderation.image.flagged': {
    label: 'Photo flagged',
    category: 'system',
    severity: 'notice',
    targetType: 'user',
    message: "{actor}'s photo was flagged for review",

    fields: [
      { label: 'Photo', key: 'kind', format: 'label' },
      { label: 'Flagged for', key: 'categories' },
      { label: 'Top score', key: 'topScore' },
    ],
  },

  'moderation.image.blocked': {
    label: 'Photo blocked',
    category: 'system',
    severity: 'warning',
    targetType: 'user',
    message: "{actor}'s photo was blocked",

    fields: [
      { label: 'Photo', key: 'kind', format: 'label' },
      { label: 'Flagged for', key: 'categories' },
      { label: 'Top score', key: 'topScore' },
    ],
  },

  'moderation.user.repeat_blocks': {
    label: 'Repeated photo blocks',
    category: 'system',
    severity: 'warning',
    targetType: 'user',
    message: '{actor} had several photos blocked in a short time',

    fields: [
      { label: 'Blocked photos', key: 'count' },
      { label: 'Within (hours)', key: 'hours' },
    ],
  },
};

function getActionDef(action) {
  const def = AUDIT_ACTIONS[action];
  if (!def) throw new Error(`Unregistered audit action "${action}"`);
  return def;
}

function retentionDaysFor(action) {
  return RETENTION_DAYS[getActionDef(action).severity];
}

function capturesNetwork(action) {
  const def = getActionDef(action);
  return Boolean(def.network) || NETWORK_CATEGORIES.includes(def.category);
}

module.exports = {
  SEVERITIES,
  HEALTH_FIELDS,
  retentionDaysFor,
  capturesNetwork,
  CATEGORIES,
  AUDIT_ACTIONS,
  getActionDef,
};
