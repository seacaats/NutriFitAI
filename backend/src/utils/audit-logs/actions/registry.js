/**
 * WHY A REGISTRY RATHER THAN FREE STRINGS
 * ---------------------------------------
 * audit_logs.action is already documented in models/AuditLog.js as
 * "machine-readable and namespaced by convention ... never a free sentence".
 * That convention only holds if something enforces it. Without this file the
 * first admin table built over the collection has to parse prose, and two call
 * sites inevitably spell the same event two ways ("profile.updated" vs
 * "profile.update") -- at which point grouping and filtering are dead.
 *
 * So: the action string stays the stored value, and everything human about it
 * (the label, the sentence, the colour, the audience) is derived here at READ
 * time. Nothing human is ever written into the collection. That matters
 * because copy changes -- "Admin John edited User Ivan's Profile" becoming
 * "John (admin) edited Ivan's profile" is a one-line edit here and requires no
 * migration of historical rows.
 *
 * NAMING FORMAT: <domain>.<entity>.<verb_past>
 *   auth.login.succeeded      admin.user.role_changed     nutrition.scan.failed
 * Lowercase, snake_case within a segment, verb always past tense. Two or three segments.
 *
 * THE `details` CONTRACT
 * ----------------------
 * details is Mixed, but a field edit -- by far the most common audited event
 * -- always uses the same shape:
 *
 *   details.changes = [{ field: 'email', from: 'a@x.com', to: 'b@x.com' }, ...]
 *
 * One shape means one renderer: formatAuditEntry turns any edit of any entity
 * into a labelled before/after list without the registry needing an entry
 * per field. Anything else an action wants to record goes alongside it as
 * plain keys, shown through the action's `fields`.
 *
 * REDACTION IS NOT COSMETIC
 * -------------------------
 * `from`/`to` values, IP addresses, user agents, IDs and fields marked
 * `superadmin` are withheld from the admin view.
 */

const AUDIENCES = ['admin', 'superadmin'];

// Days a row is kept, by severity. Stamped onto the row as expiresAt at write
// time and removed by the audit_logs_expiry TTL index (migration 004).
// Changing a value only affects rows written after the change
const RETENTION_DAYS = {
  info: 365,
  notice: 365,
  warning: 730,
  critical: 1095,
};

// Only these categories store the IP address and user agent. Everywhere else
// the network detail adds nothing to the trail, so it isn't collected
const NETWORK_CATEGORIES = ['auth', 'administration'];

// Health measurements (sensitive personal information under the Data Privacy Act).
// A change to one records the field name only, never the from/to values --
// the values already live on the user's own record. Dropdown choices (sex,
// diet, health conditions) are recorded with their values
const HEALTH_FIELDS = [
  'age',
  'heightCm',
  'weightKg',
  'targetWeightKg',
  'weeklyPaceKg',
];

/**  
 *   info     routine, expected, high volume
 *   notice   worth noticing in a list, not worth acting on
 *   warning  a failure, a rejection, or a manual override of automation`
 *   critical privileged action, or one that destroys/exposes data
 */
const SEVERITIES = ['info', 'notice', 'warning', 'critical'];

// Filters for the audit logs
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
 * @property {boolean} [network]  store IP/user agent even outside NETWORK_CATEGORIES
 * @property {string} label       short noun phrase for the table's Action column
 * @property {string} category    one of CATEGORIES
 * @property {string} severity    one of SEVERITIES
 * @property {string|null} targetType  what the action acts on, when not the actor
 * @property {string} audience    minimum role that may see this entry at all
 * @property {string} message     one plain sentence, the same for every viewer
 * @property {Array<{label: string, key?: string, value?: string, format?: string, superadmin?: boolean}>} fields
 *                                labelled values for the expanded row. `format`
 *                                is one of yesno, label, counts, day, datetime,
 *                                filters, action (see formatField)
 *
 * The message interpolates {actor}, {target} and any key of `details`, codes
 * turned into words (LABELS). IPs, IDs and values never go in the sentence:
 * they are fields, or the row's own IP / user agent / changes columns.
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
    audience: 'admin',
    message: '{actor} created an account',

    fields: [],
  },

  // Already written by authController. Records that consent happened and what
  // categories were supplied -- never the health/diet content itself.
  'auth.register.consent_accepted': {
    label: 'Terms accepted',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    audience: 'admin',
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
    audience: 'admin',
    message: '{actor} verified their email',

    fields: [],
  },

  'auth.login.succeeded': {
    label: 'Signed in',
    category: 'auth',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} signed in',

    fields: [
      { label: 'Method', key: 'method', format: 'label' },
    ],
  },

  /**
   * Superadmin-only, and the one action that regularly has a null actor: a
   * failed login against an address matching no account has nobody to
   * attribute it to. The schema's nullable userId exists for exactly this.
   * Restricted because a list of failed attempts against real addresses is an
   * account-enumeration aid in its own right.
   *
   * The attempted email is never stored, only details.emailHash (HMAC, see
   * auditLogger.hashIdentifier) -- users sometimes type their password into
   * the email field. Repeated attempts on one address share a hash
   */
  'auth.login.failed': {
    label: 'Sign-in failed',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    audience: 'superadmin',
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
    audience: 'admin',
    message: '{actor} turned on two-factor sign-in',

    fields: [],
  },

  'auth.mfa.disabled': {
    label: 'Two-factor turned off',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} turned off two-factor sign-in',

    fields: [],
  },

  'auth.mfa.recovery_regenerated': {
    label: 'Recovery codes regenerated',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} generated new recovery codes',

    fields: [],
  },

  'auth.mfa.recovery_used': {
    label: 'Recovery code used',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} signed in with a recovery code',

    fields: [],
  },

  'auth.mfa.failed': {
    label: 'Two-factor code rejected',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    audience: 'admin',
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
    audience: 'admin',
    message: 'Two-factor sign-in was locked for {target}',

    fields: [],
  },

  'auth.logout': {
    label: 'Signed out',
    category: 'auth',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} signed out',

    fields: [],
  },

  'auth.password.reset_requested': {
    label: 'Password reset requested',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} requested a password reset',

    fields: [],
  },

  'auth.password.reset_completed': {
    label: 'Password changed',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} reset their password',

    fields: [],
  },

  'auth.password.changed': {
    label: 'Password changed',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    audience: 'admin',
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
    audience: 'admin',
    message: '{actor} linked their {provider} account',

    fields: [],
  },

  /**
   * Fires when apiClient's silent refresh is refused -- a refresh cookie that
   * is expired, revoked or forged. Individually unremarkable; a burst of them
   * against one account is not, which is the whole reason it is recorded.
   */
  'auth.token.refresh_rejected': {
    label: 'Session refresh rejected',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    audience: 'superadmin',
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
    audience: 'superadmin',
    message: 'Verification code resent to {actor}',

    fields: [],
  },

  'auth.password.reset_otp_verified': {
    label: 'Reset code verified',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} entered their reset code',

    fields: [],
  },

  // Written once per key per window (the first blocked request), never per
  // blocked request -- a flood must not be able to flood the trail too
  'auth.login.rate_limited': {
    label: 'Rate limit hit',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    audience: 'superadmin',
    message: 'Too many {limiter} attempts',

    fields: [
      { label: 'Email hash', key: 'emailHash' },
    ],
  },

  // Wrong current password in Settings. The account is signed in, so a run of
  // these is someone guessing at an unlocked device
  'auth.password.verify_failed': {
    label: 'Password check failed',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    audience: 'admin',
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
    audience: 'admin',
    message: '{actor} updated their profile',

    fields: [],
  },

  // The setup wizard, finished or skipped. Goal targets aren't recorded, the
  // same as when they're saved from their own cards
  'account.setup.completed': {
    label: 'Setup completed',
    category: 'account',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
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
    audience: 'admin',
    message: '{actor} changed their profile photo',

    fields: [],
  },

  'account.avatar.removed': {
    label: 'Photo removed',
    category: 'account',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} removed their profile photo',

    fields: [],
  },

  /**
   * goals is append-only history, so this is a new entry rather than an edit
   * -- which is why it reads "set" and not "changed", and why the detail names
   * the effective date the new entry carries.
   */
  'account.goal.changed': {
    label: 'Goal changed',
    category: 'account',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} changed their goal to {fitnessGoal}',

    fields: [
      { label: 'Previous goal', key: 'previousGoal', format: 'label' },
      { label: 'Effective', key: 'effectiveFrom', format: 'day' },
    ],
  },

  /**
   * Critical and self-directed. accountDeletion.js clears every collection the user owns, and
   * this entry is the only thing that survives it -- audit_logs is deliberately
   * not one of the nine. The detail records what was removed, since after the
   * fact there is nothing left to inspect.
   */
  'account.deleted': {
    network: true,
    label: 'Account deleted',
    category: 'account',
    severity: 'critical',
    targetType: 'user',
    audience: 'admin',
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
    audience: 'admin',
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
    audience: 'admin',
    message: '{actor} disconnected {previousSource}',

    fields: [],
  },

  // =========================================================================
  // food scanner and meals
  // =========================================================================
  /**
   * The recognition pipeline is not integrated yet (food_scans documents are
   * written with status 'processing' and nothing completes them). This entry
   * is what makes the failure rate visible the day it does land -- a scanner
   * that silently fails for one user looks identical to a user who stopped
   * scanning, and only this distinguishes them.
   */
  'nutrition.scan.failed': {
    label: 'Food scan failed',
    category: 'nutrition',
    severity: 'warning',
    targetType: 'food_scan',
    audience: 'admin',
    message: "{actor}'s food scan failed",
    fields: [
      { label: 'Reason', key: 'reason' },
      { label: 'Stage', key: 'stage', format: 'label' },
      { label: 'Scan ID', key: 'targetId', superadmin: true },
    ],
  },

  // =========================================================================
  // workout
  // =========================================================================
  /**
   * System actor: written by scripts/sync-workouts.js via logSystemAction,
   * which has no req to read an IP from. The detail therefore names counts
   * rather than a network origin.
   */
  'workout.catalog.synced': {
    label: 'Exercise catalog synced',
    category: 'workout',
    severity: 'notice',
    targetType: 'system',
    audience: 'superadmin',
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
  /**
   * The failover chain's own observability. quotaStore/router already
   * distinguish burst from daily limits; this is where that distinction
   * becomes visible outside the server log.
   */
  'coach.provider.failover': {
    label: 'AI provider failover',
    category: 'coach',
    severity: 'warning',
    targetType: 'system',
    audience: 'superadmin',
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
    audience: 'superadmin',
    message: "{provider}'s quota ran out",
    fields: [
      { label: 'Limit', key: 'limitKind', format: 'label' },
      { label: 'Resumes', key: 'resumesAt', format: 'datetime' },
    ],
  },

  // =========================================================================
  // notification -- push preferences and delivery
  //
  // Push tokens are never stored, only details.tokenHash (auditLogger.
  // hashIdentifier), which pairs a registered row with its revoked row.
  // Notification content and successful sends are never recorded
  // =========================================================================
  'account.notifications.toggled': {
    label: 'Notification settings changed',
    category: 'notification',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
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
    audience: 'admin',
    message: '{actor} registered a device for notifications',

    fields: [
      { label: 'Platform', key: 'platform', format: 'label' },
      { label: 'Token hash', key: 'tokenHash', superadmin: true },
    ],
  },

  'account.push_token.revoked': {
    label: 'Device unregistered',
    category: 'notification',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} unregistered a device from notifications',

    fields: [
      { label: 'Token hash', key: 'tokenHash', superadmin: true },
    ],
  },

  'notification.delivery.failed': {
    label: 'Notification failed',
    category: 'notification',
    severity: 'warning',
    targetType: 'user',
    audience: 'superadmin',
    message: 'A notification to {target} failed',

    fields: [
      { label: 'Kind', key: 'kind', format: 'label' },
      { label: 'Reason', key: 'reason' },
      { label: 'Token hash', key: 'tokenHash' },
    ],
  },

  // Expo answered DeviceNotRegistered, so the token was dropped
  'notification.push_token.invalidated': {
    label: 'Device token invalidated',
    category: 'notification',
    severity: 'notice',
    targetType: 'user',
    audience: 'superadmin',
    message: 'A device token for {target} was invalidated',

    fields: [
      { label: 'Token hash', key: 'tokenHash' },
    ],
  },

  // =========================================================================
  // administration -- one privileged account acting on another account
  //
  // Every action in this group is `critical` without exception. These are the
  // entries the whole audit surface exists for: an admin acting on somebody
  // else's record is the only category where the actor and the subject differ
  // and the subject cannot see it happen.
  // =========================================================================
  /**
   * Recording a READ looks paranoid until you consider that the users
   * management page exposes every user's email and profile. Restricted to
   * superadmin so the admin table is not swamped by its own browsing.
   */
  'admin.user.viewed': {
    label: 'User record viewed',
    category: 'administration',
    severity: 'notice',
    targetType: 'user',
    audience: 'superadmin',
    message: "{actor} viewed {target}'s account",
    fields: [],
  },

  'admin.user.profile_updated': {
    label: 'User profile edited',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'admin',
    // The example from the brief, generalised: the admin view names the fields,
    // the superadmin view names the values and the origin.
    message: '{actor} renamed {target}',

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.role_changed': {
    label: 'Role changed',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} made {target} {toRoleWithArticle}',

    fields: [
      { label: 'Previous role', key: 'fromRole', format: 'label' },
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.suspended': {
    label: 'User suspended',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} suspended {target}',

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.reinstated': {
    label: 'User reinstated',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'admin',
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
    audience: 'admin',
    message: "{actor} deleted {target}'s account",
    fields: [
      { label: 'Removed', key: 'deletedCounts', format: 'counts' },
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.password_reset_forced': {
    label: 'Password reset forced',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} required {target} to reset their password',

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.user.password_reset_cancelled': {
    label: 'Password reset cancelled',
    category: 'administration',
    severity: 'warning',
    targetType: 'user',
    audience: 'admin',
    message: '{actor} cancelled the password reset for {target}',

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.admin.created': {
    label: 'Admin granted',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'superadmin',
    message: '{actor} gave {target} {toRole} access',

    fields: [
      { label: 'Reason', key: 'reason' },
    ],
  },

  'admin.admin.revoked': {
    label: 'Admin revoked',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'superadmin',
    message: "{actor} removed {target}'s admin access",
    fields: [
      { label: 'Previous role', key: 'fromRole', format: 'label' },
      { label: 'Reason', key: 'reason' },
    ],
  },

  // Reads of the trail itself. Page 1 only, once per admin per filter set
  // per 5 minutes; a new filter always writes its own row (controllers/admin/auditController)
  'admin.audit_log.viewed': {
    label: 'Audit log viewed',
    category: 'administration',
    severity: 'notice',
    targetType: 'system',
    audience: 'superadmin',
    message: '{actor} viewed the audit log',

    fields: [
      { label: 'Filters', key: 'filters', format: 'filters' },
    ],
  },

  /**
   * Auditing the audit trail. An export lifts the entire trail -- including
   * every redacted value -- out of the system, which is the single most
   * consequential thing a superadmin can do here.
   */
  // Holds keep a row past its expiry (models/AuditHold.js). The row itself
  // is never touched, so both directions are their own critical entries
  'admin.audit_log.held': {
    label: 'Audit entry held',
    category: 'administration',
    severity: 'critical',
    targetType: 'system',
    audience: 'superadmin',
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
    audience: 'superadmin',
    message: "{actor} released an audit entry's hold",
    fields: [
      { label: 'Entry', key: 'heldAction', format: 'action' },
      { label: 'Reason', key: 'reason' },
      { label: 'Entry ID', key: 'auditLogId' },
    ],
  },

  // The note's text lives in audit_notes, shown under the row it's about.
  // This entry only records that one was added
  'admin.audit_log.note_added': {
    label: 'Audit note added',
    category: 'administration',
    severity: 'notice',
    targetType: 'system',
    audience: 'admin',
    message: '{actor} added a note to an audit entry',
    fields: [
      { label: 'Entry', key: 'notedAction', format: 'action' },
      { label: 'Entry ID', key: 'auditLogId', superadmin: true },
    ],
  },

  'admin.audit_log.exported': {
    label: 'Audit log exported',
    category: 'administration',
    severity: 'critical',
    targetType: 'system',
    audience: 'superadmin',
    message: '{actor} exported {rowCount} audit entries',

    fields: [
      { label: 'Filters', key: 'filters', format: 'exportFilters' },
      { label: 'Capped at the export limit', key: 'capped', format: 'yesno' },
    ],
  },

  // =========================================================================
  // system -- no human actor
  // =========================================================================
  'system.retention.scan_images_purged': {
    label: 'Retention job ran',
    category: 'system',
    severity: 'info',
    targetType: 'system',
    audience: 'superadmin',
    message: 'Removed {purgedCount} food scan photos over {retentionDays} days old',

    fields: [],
  },

  // Written by the chain check in server.js when a row was edited or removed
  // outside the TTL. brokenAt is the first row whose prevHash doesn't match
  'system.audit_chain.broken': {
    label: 'Audit chain broken',
    category: 'system',
    severity: 'critical',
    targetType: 'system',
    audience: 'superadmin',
    message: 'Audit log integrity check failed',

    fields: [
      { label: 'Entries', key: 'chain', format: 'label' },
      { label: 'Problem', key: 'reason', format: 'label' },
      { label: 'Row ID', key: 'brokenAt' },
    ],
  },
};

// ===========================================================================
// Lookups
// ===========================================================================

// Only registered actions exist. An unregistered one throws, so a typo at a
// call site is refused at write time (logAction logs and drops it) rather
// than stored
function getActionDef(action) {
  const def = AUDIT_ACTIONS[action];
  if (!def) throw new Error(`Unregistered audit action "${action}"`);
  return def;
}

/** True when `role` is at or above the action's minimum audience. */
function canViewAction(action, viewerRole) {
  const def = getActionDef(action);
  const needed = AUDIENCES.indexOf(def.audience);
  const held = AUDIENCES.indexOf(viewerRole);
  return needed >= 0 && held >= needed;
}

// A note entry names the action it was added to, so it is only as visible as that action
function canViewEntry(entry, viewerRole) {
  if (!canViewAction(entry.action, viewerRole)) return false;
  if (entry.action !== 'admin.audit_log.note_added') return true;
  const noted = entry.details && entry.details.notedAction;
  return Boolean(noted && AUDIT_ACTIONS[noted]) && canViewAction(noted, viewerRole);
}

/** Every action a viewer of this role is allowed to see, for the filter menu. */
function visibleActionsFor(viewerRole) {
  return Object.keys(AUDIT_ACTIONS).filter((action) => canViewAction(action, viewerRole));
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
  canViewAction,
  canViewEntry,
  visibleActionsFor,
};