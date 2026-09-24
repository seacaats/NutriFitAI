/**
 * WHY A REGISTRY RATHER THAN FREE STRINGS
 * ---------------------------------------
 * audit_logs.action is already documented in models/schemas/index.js as
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
 * One shape means one renderer: `changeList` below turns any edit of any
 * entity into "email from a@x.com to b@x.com" without the registry needing an
 * entry per field. Anything else an action wants to record goes alongside it
 * as plain keys and is addressable from a template as {keyName}.
 *
 * REDACTION IS NOT COSMETIC
 * -------------------------
 * `from`/`to` values, IP addresses and user agents are withheld from 
 * the admin view and shown only to a superadmin.
 */

const AUDIENCES = ['admin', 'superadmin'];

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
  'administration',
  'system',
];

/**
 * @typedef {object} AuditActionDef
 * @property {string} label       short noun phrase for the table's Action column
 * @property {string} category    one of CATEGORIES
 * @property {string} severity    one of SEVERITIES
 * @property {string|null} targetType  what the action acts on, when not the actor
 * @property {string} audience    minimum role that may see this entry at all
 * @property {string} summary     admin-facing sentence; no values, no network detail
 * @property {string} [detail]    superadmin-facing sentence; may interpolate values
 *
 * Templates interpolate {token} against the context built in buildContext():
 * the actor/target labels, every key of `details`, and the derived {changeList}
 * / {changeFields}. An unresolved token renders as a neutral placeholder rather
 * than the literal braces, so a call site that forgets a detail key produces a
 * slightly vaguer sentence instead of a broken one.
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
    summary: '{target} created an account',
    detail: '{target} created an account from IP address {ip}',
  },

  // Already written by authController. Records that consent happened and what
  // categories were supplied -- never the health/diet content itself.
  'auth.register.consent_accepted': {
    label: 'Terms accepted',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    audience: 'admin',
    summary: '{target} accepted the terms of service',
    detail:
      '{target} accepted the terms of service from IP address {ip} '
      + '(diet preference supplied: {providedDietPreference}, '
      + 'health conditions supplied: {providedHealthConditions})',
  },

  'auth.email.verified': {
    label: 'Email verified',
    category: 'auth',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
    summary: '{target} verified their email address',
    detail: '{target} verified their email address from IP address {ip}',
  },

  'auth.login.succeeded': {
    label: 'Signed in',
    category: 'auth',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
    summary: '{actor} signed in',
    detail: '{actor} signed in via {method} from IP address {ip} using {userAgent}',
  },

  /**
   * Superadmin-only, and the one action that regularly has a null actor: a
   * failed login against an address matching no account has nobody to
   * attribute it to. The schema's nullable userId exists for exactly this.
   * Restricted because a list of failed attempts against real addresses is an
   * account-enumeration aid in its own right.
   */
  'auth.login.failed': {
    label: 'Sign-in failed',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    audience: 'superadmin',
    summary: 'A sign-in attempt failed',
    detail:
      'A sign-in attempt for {emailAttempted} failed ({reason}) from IP address {ip} '
      + 'using {userAgent}',
  },

  'auth.logout': {
    label: 'Signed out',
    category: 'auth',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
    summary: '{actor} signed out',
    detail: '{actor} signed out from IP address {ip}',
  },

  'auth.password.reset_requested': {
    label: 'Password reset requested',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    audience: 'admin',
    summary: '{target} requested a password reset',
    detail: '{target} requested a password reset from IP address {ip}',
  },

  'auth.password.reset_completed': {
    label: 'Password changed',
    category: 'auth',
    severity: 'warning',
    targetType: 'user',
    audience: 'admin',
    summary: "{target}'s password was changed",
    detail: "{target}'s password was changed from IP address {ip} using {userAgent}",
  },

  'auth.oauth.linked': {
    label: 'Social account linked',
    category: 'auth',
    severity: 'notice',
    targetType: 'user',
    audience: 'admin',
    summary: '{target} linked a {provider} account',
    detail: '{target} linked a {provider} account from IP address {ip}',
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
    summary: 'A session refresh was rejected',
    detail: 'A session refresh for {target} was rejected ({reason}) from IP address {ip}',
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
    summary: '{actor} updated their profile ({changeFields})',
    detail: '{actor} updated their profile: {changeList} -- from IP address {ip}',
  },

  'account.avatar.updated': {
    label: 'Photo updated',
    category: 'account',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
    summary: '{actor} updated their profile photo',
    detail: '{actor} updated their profile photo from IP address {ip}',
  },

  'account.avatar.removed': {
    label: 'Photo removed',
    category: 'account',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
    summary: '{actor} removed their profile photo',
    detail: '{actor} removed their profile photo from IP address {ip}',
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
    summary: '{actor} changed their fitness goal',
    detail: '{actor} set their fitness goal to {fitnessGoal}, effective {effectiveFrom}',
  },

  'account.weight.logged': {
    label: 'Weight logged',
    category: 'account',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
    summary: '{actor} logged a weight measurement',
    detail: '{actor} logged a weight measurement of {weightKg} kg',
  },

  /**
   * Critical and self-directed. userDeletion.js clears nine collections, and
   * this entry is the only thing that survives it -- audit_logs is deliberately
   * not one of the nine. The detail records what was removed, since after the
   * fact there is nothing left to inspect.
   */
  'account.deleted': {
    label: 'Account deleted',
    category: 'account',
    severity: 'critical',
    targetType: 'user',
    audience: 'admin',
    summary: "{target}'s account was deleted",
    detail:
      "{target}'s account ({targetId}) was deleted by {actor} from IP address {ip}; "
      + 'removed {deletedCounts}',
  },

  // =========================================================================
  // daily steps
  // =========================================================================
  /**
   * Fires on every app foreground, so this is the highest-volume action in the
   * catalogue by a wide margin. It is recorded per SYNC CALL, never per day
   * synced -- a 31-day backfill is one entry carrying dayCount, not 31 entries.
   * See the plan's volume note: without that rule this action alone would
   * outgrow every other collection.
   */
  'activity.steps.synced': {
    label: 'Steps synced',
    category: 'activity',
    severity: 'info',
    targetType: 'user',
    audience: 'superadmin',
    summary: '{actor} synced step data',
    detail: '{actor} synced {dayCount} day(s) of step data from {source} ({totalSteps} steps)',
  },

  /**
   * A manual entry overrides sensor data, so unlike a sync it is worth seeing
   * at admin level: it is the one path by which a step figure can be a claim
   * rather than a measurement.
   */
  'activity.steps.manual_entry': {
    label: 'Steps entered manually',
    category: 'activity',
    severity: 'notice',
    targetType: 'user',
    audience: 'admin',
    summary: '{actor} entered steps manually for {activityDate}',
    detail:
      '{actor} manually set steps for {activityDate} to {stepCount} '
      + '(previously {previousStepCount}) from IP address {ip}',
  },

  'activity.steps.source_changed': {
    label: 'Step source changed',
    category: 'activity',
    severity: 'info',
    targetType: 'user',
    audience: 'admin',
    summary: '{actor} changed their step source',
    detail: '{actor} changed their step source from {previousSource} to {source}',
  },

  'activity.steps.permission_revoked': {
    label: 'Step permission revoked',
    category: 'activity',
    severity: 'notice',
    targetType: 'user',
    audience: 'admin',
    summary: '{actor} disconnected step tracking',
    detail: '{actor} disconnected step tracking (was {previousSource})',
  },

  // =========================================================================
  // food scanner and meals
  // =========================================================================
  'nutrition.scan.created': {
    label: 'Food scan uploaded',
    category: 'nutrition',
    severity: 'info',
    targetType: 'food_scan',
    audience: 'admin',
    summary: '{actor} uploaded a food scan',
    detail: '{actor} uploaded a food scan ({targetId}, {byteSize} bytes, {mimeType})',
  },

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
    summary: "{actor}'s food scan failed to process",
    detail: "{actor}'s food scan {targetId} failed to process: {reason} (stage: {stage})",
  },

  'nutrition.scan.image_purged': {
    label: 'Scan image purged',
    category: 'nutrition',
    severity: 'info',
    targetType: 'food_scan',
    audience: 'superadmin',
    summary: 'A food scan image was purged on retention',
    detail:
      'Food scan {targetId} had its image purged after {retentionDays} days '
      + '(storage key released; the scan document and its snapshotted nutrition survive)',
  },

  'nutrition.meal.logged': {
    label: 'Meal logged',
    category: 'nutrition',
    severity: 'info',
    targetType: 'meal',
    audience: 'admin',
    summary: '{actor} logged a {mealType}',
    detail: '{actor} logged a {mealType} with {itemCount} item(s), {caloriesKcal} kcal total',
  },

  'nutrition.meal.deleted': {
    label: 'Meal deleted',
    category: 'nutrition',
    severity: 'notice',
    targetType: 'meal',
    audience: 'admin',
    summary: '{actor} deleted a logged meal',
    detail: '{actor} deleted meal {targetId} ({mealType}, {caloriesKcal} kcal)',
  },

  // =========================================================================
  // workout
  // =========================================================================
  'workout.session.completed': {
    label: 'Workout completed',
    category: 'workout',
    severity: 'info',
    targetType: 'workout_session',
    audience: 'admin',
    summary: '{actor} completed a workout',
    detail:
      '{actor} completed a {kind} workout ({exerciseName}) in {actualDurationSeconds}s, '
      + '{completedSets} set(s)',
  },

  'workout.session.deleted': {
    label: 'Workout deleted',
    category: 'workout',
    severity: 'notice',
    targetType: 'workout_session',
    audience: 'admin',
    summary: '{actor} deleted a workout session',
    detail: '{actor} deleted workout session {targetId} ({kind}, status {status})',
  },

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
    summary: 'The exercise catalog was synced from wger',
    detail:
      'The exercise catalog was synced from wger: {added} added, {updated} updated, '
      + '{skipped} skipped',
  },

  // =========================================================================
  // coach -- AI chat
  // =========================================================================
  /**
   * NOTE the absence of an action for message CONTENT. contextBuilder already
   * assembles prompts "without transmitting identity fields", and an audit
   * trail that stored what a user asked their health coach would undo that in
   * one line. Only the fact, the provider and the shape are recorded.
   */
  'coach.message.sent': {
    label: 'Coach message sent',
    category: 'coach',
    severity: 'info',
    targetType: 'chat_conversation',
    audience: 'superadmin',
    summary: '{actor} sent a message to the AI coach',
    detail:
      '{actor} sent a message to the AI coach in conversation {targetId}, '
      + 'answered by {provider} in {latencyMs}ms',
  },

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
    summary: 'The AI coach failed over to another provider',
    detail:
      'The AI coach failed over from {fromProvider} to {toProvider}: {reason} '
      + '(retry after {retryAfterSeconds}s)',
  },

  'coach.quota.exhausted': {
    label: 'AI quota exhausted',
    category: 'coach',
    severity: 'warning',
    targetType: 'system',
    audience: 'superadmin',
    summary: 'An AI provider quota was exhausted',
    detail: '{provider} quota exhausted ({limitKind}); skipping until {resumesAt}',
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
    summary: '{actor} viewed a user record',
    detail: "{actor} viewed {target}'s record from IP address {ip}",
  },

  'admin.user.profile_updated': {
    label: 'User profile edited',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'admin',
    // The example from the brief, generalised: the admin view names the fields,
    // the superadmin view names the values and the origin.
    summary: "{actor} edited {target}'s profile ({changeFields})",
    detail:
      "{actor} changed {target}'s {changeList} from IP address {ip} using {userAgent}",
  },

  'admin.user.role_changed': {
    label: 'Role changed',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'admin',
    summary: "{actor} changed {target}'s role",
    detail:
      "{actor} changed {target}'s role from {fromRole} to {toRole} "
      + 'from IP address {ip}',
  },

  'admin.user.suspended': {
    label: 'User suspended',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'admin',
    summary: '{actor} suspended {target}',
    detail: '{actor} suspended {target} ({reason}) from IP address {ip}',
  },

  'admin.user.reinstated': {
    label: 'User reinstated',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'admin',
    summary: '{actor} reinstated {target}',
    detail: '{actor} reinstated {target} from IP address {ip}',
  },

  'admin.user.deleted': {
    label: 'User deleted',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'admin',
    summary: '{actor} deleted the account belonging to {target}',
    detail:
      '{actor} deleted the account belonging to {target} ({targetId}) '
      + 'from IP address {ip}; removed {deletedCounts}',
  },

  'admin.user.password_reset_forced': {
    label: 'Password reset forced',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'admin',
    summary: '{actor} forced a password reset for {target}',
    detail: '{actor} forced a password reset for {target} from IP address {ip}',
  },

  'admin.admin.created': {
    label: 'Admin granted',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'superadmin',
    summary: '{actor} granted admin access to {target}',
    detail:
      '{actor} granted admin access to {target} ({targetId}) from IP address {ip}',
  },

  'admin.admin.revoked': {
    label: 'Admin revoked',
    category: 'administration',
    severity: 'critical',
    targetType: 'user',
    audience: 'superadmin',
    summary: '{actor} revoked admin access from {target}',
    detail:
      '{actor} revoked admin access from {target} ({targetId}) from IP address {ip}',
  },

  /**
   * Auditing the audit trail. An export lifts the entire trail -- including
   * every redacted value -- out of the system, which is the single most
   * consequential thing a superadmin can do here.
   */
  'admin.audit_log.exported': {
    label: 'Audit log exported',
    category: 'administration',
    severity: 'critical',
    targetType: 'system',
    audience: 'superadmin',
    summary: '{actor} exported the audit log',
    detail:
      '{actor} exported {rowCount} audit entries ({fromDate} to {toDate}) '
      + 'from IP address {ip}',
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
    summary: 'The scan-image retention job ran',
    detail:
      'The scan-image retention job purged {purgedCount} image(s) older than '
      + '{retentionDays} days, freeing {freedBytes} bytes',
  },

  'system.db.bootstrap_ran': {
    label: 'Database bootstrap ran',
    category: 'system',
    severity: 'notice',
    targetType: 'system',
    audience: 'superadmin',
    summary: 'The database bootstrap script ran',
    detail:
      'The database bootstrap script ran against {dbName}: {collectionCount} collections, '
      + '{indexCount} indexes ({droppedStale} stale dropped)',
  },
};

// ===========================================================================
// Rendering
// ===========================================================================

/**
 * Fallback for an action string with no registry entry.
 *
 * Reachable in exactly one situation that matters: an entry written by an
 * older deploy whose action has since been renamed or removed. Dropping such
 * a row from the table would be the worst possible behaviour for an audit
 * surface -- the rows you cannot explain are the ones worth showing -- so it
 * degrades to the raw action string instead, at admin visibility and `notice`
 * severity so it neither hides nor cries wolf.
 */
function unknownAction(action) {
  return {
    label: action,
    category: 'system',
    severity: 'notice',
    targetType: null,
    audience: 'admin',
    summary: '{actor} performed {action}',
    detail: '{actor} performed {action} from IP address {ip}',
    unknown: true,
  };
}

function getActionDef(action) {
  return AUDIT_ACTIONS[action] || unknownAction(action);
}

/** True when `role` is at or above the action's minimum audience. */
function canViewAction(action, viewerRole) {
  const def = getActionDef(action);
  const needed = AUDIENCES.indexOf(def.audience);
  const held = AUDIENCES.indexOf(viewerRole);
  return needed >= 0 && held >= needed;
}

/** Every action a viewer of this role is allowed to see, for the filter menu. */
function visibleActionsFor(viewerRole) {
  return Object.keys(AUDIT_ACTIONS).filter((action) => canViewAction(action, viewerRole));
}

/**
 * Renders a changes[] array as prose.
 *
 * Redacted mode is not "hide the change" -- it still names every field that
 * moved, because "an admin changed this user's email" is the part an admin
 * needs. Only the before/after values are withheld.
 *
 *   full:     "email from ivan@old.com to ivan@new.com, and full name from Ivan to Ivan R."
 *   redacted: "email and full name"
 */
/**
 * Unit suffixes this codebase appends to field names.
 *
 * The convention (heightCm, weightKg, dailyCaloriesKcal, amountMl,
 * actualDurationSeconds) is good for code and terrible read aloud -- "height
 * cm from 170 to 172". Stripping the suffix is preferred to a hand-maintained
 * label map for every audited field, which would silently drift out of sync
 * with the validators the moment a field is added.
 *
 * The unit is not lost: it is still in the value's own context, and the
 * superadmin row carries the raw changes[] array with the original field name.
 */
const UNIT_SUFFIXES = ['Cm', 'Kg', 'Kcal', 'Ml', 'Seconds', 'Minutes', 'Meters', 'G'];

function humanField(field) {
  let name = String(field);

  for (const suffix of UNIT_SUFFIXES) {
    // Only strip a suffix that leaves something behind, so a field genuinely
    // called "g" or "cm" survives intact.
    if (name.length > suffix.length && name.endsWith(suffix)) {
      name = name.slice(0, -suffix.length);
      break;
    }
  }

  // camelCase / snake_case / dotted path -> spaced words.
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.]/g, ' ')
    .trim()
    .toLowerCase();
}

function joinList(parts) {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function renderChanges(changes, { redactValues }) {
  if (!Array.isArray(changes) || changes.length === 0) return { list: '', fields: '' };

  const fields = joinList(changes.map((c) => humanField(c.field)));

  if (redactValues) return { list: fields, fields };

  const list = joinList(
    changes.map((c) => {
      const from = c.from === undefined || c.from === null || c.from === '' ? 'empty' : String(c.from);
      const to = c.to === undefined || c.to === null || c.to === '' ? 'empty' : String(c.to);
      return `${humanField(c.field)} from ${from} to ${to}`;
    }),
  );

  return { list, fields };
}

/**
 * Turns a stored entry into the flat token bag the templates interpolate.
 *
 * Actor and target read from the SNAPSHOT labels on the document
 * (actorLabel / targetLabel), never from a live join. A live lookup would
 * rewrite history: a user who later changes their name, or is deleted
 * outright, would silently change or blank every past entry about them --
 * which is precisely what an audit trail must not do.
 */
/**
 * "Admin John" / "User Ivan" -- the role prefix is what makes a one-line entry
 * legible without a second column, and it comes from the SNAPSHOTTED role, so
 * a later promotion does not retroactively re-title past actions.
 */
const ROLE_TITLES = { superadmin: 'Superadmin', admin: 'Admin', user: 'User' };

function withRole(name, role) {
  if (!name) return null;
  const title = ROLE_TITLES[role];
  return title ? `${title} ${name}` : name;
}

/**
 * What to call a party whose NAME is not on the entry.
 *
 * A MISSING LABEL IS NOT EVIDENCE OF DELETION. This used to render as
 * "A deleted account", which is a lie in the two cases that matter most:
 *
 *   1. Rows written BEFORE actorLabel/targetLabel existed. Every entry
 *      already in the collection is one of these -- a userId and a role and
 *      no label -- and "User A deleted account accepted the terms of
 *      service", about a live account, is worse than useless in the one
 *      surface whose whole job is to be trusted.
 *   2. A row whose name lookup failed transiently at write time.
 *      resolveActor deliberately swallows that error and records null rather
 *      than losing the entry, so a live user can legitimately have no label.
 *
 * Nothing in the row distinguishes "deleted" from "never recorded", so the
 * wording no longer claims to. It falls back to the role, which IS recorded,
 * and says only that the name is not on the entry.
 * scripts/backfill-audit-labels.js resolves most legacy rows to real names;
 * this is what the remainder read as.
 */
function unnamed(role, targetType) {
  if (role && ROLE_TITLES[role]) return `an unidentified ${role}`;
  if (targetType === 'user') return 'an unidentified user';
  return 'an unidentified account';
}

function buildContext(entry, { redactValues }) {
  const actorRole = entry.role || null;
  const actorName = entry.actorLabel || null;
  const targetName = entry.targetLabel || null;

  const selfDirected = entry.targetId && entry.userId && entry.targetId === entry.userId;

  /**
   * The target's role is snapshotted too (targetRole), for the same reason
   * the actor's is: "Admin John edited User Ivan's profile" is only accurate
   * if "User" describes what Ivan was AT THE TIME. A user promoted to admin
   * next month must not have last month's entries silently retitled.
   *
   * Falls back to 'user' rather than to nothing when the writer did not
   * supply it, which is right for every action in the administration group --
   * those act on accounts, and an account with no recorded role was an
   * ordinary user. Older rows written before targetRole existed therefore
   * still read correctly in the overwhelmingly common case.
   */
  const targetRole = selfDirected
    ? actorRole
    : (entry.targetRole || (entry.targetType === 'user' ? 'user' : null));

  const details = (entry.details && typeof entry.details === 'object') ? entry.details : {};
  const { list, fields } = renderChanges(details.changes, { redactValues });

  return {
    ...details,
    changeList: list,
    changeFields: fields,
    action: entry.action,
    // No userId at all is the one case we DO know: a cron job, a script, the
    // retention purge. A userId with no label is merely unidentified.
    actor: entry.userId
      ? (withRole(actorName, actorRole) || unnamed(actorRole, 'user'))
      : 'The system',
    // A self-directed action should read "User Ivan updated their profile",
    // not "... updated Ivan's profile" -- so {target} resolves to the actor's
    // own titled name and the templates for self-directed actions use
    // "their".
    target: selfDirected
      ? (withRole(actorName, actorRole) || unnamed(actorRole, 'user'))
      : entry.targetId
        ? (withRole(targetName, targetRole) || unnamed(targetRole, entry.targetType))
        : 'a record',
    targetId: redactValues ? '[redacted]' : (entry.targetId || 'unknown'),
    ip: redactValues ? '[redacted]' : (entry.ipAddress || 'an unknown address'),
    userAgent: redactValues ? '[redacted]' : (entry.userAgent || 'an unknown client'),
  };
}

/**
 * Resolves {token} placeholders.
 *
 * A missing token renders as "unspecified" rather than leaving braces in the
 * output. That is a deliberate soft failure: a call site that forgets to pass
 * `reason` should produce a slightly vaguer audit line, never a broken one in
 * front of a superadmin trying to understand an incident. Objects and arrays
 * are JSON-stringified so a call site passing a nested shape degrades to
 * something readable instead of "[object Object]".
 */
function interpolate(template, context) {
  return template
    .replace(/\{(\w+)\}/g, (match, key) => {
      const value = context[key];
      if (value === undefined || value === null || value === '') return 'unspecified';
      if (typeof value === 'object') return JSON.stringify(value);
      if (typeof value === 'boolean') return value ? 'yes' : 'no';
      return String(value);
    })
    // Collapse the double spaces an empty {changeList} can leave behind.
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Sentence-cases the rendered line.
 *
 * Every template begins with a {token}, and those resolve either to a proper
 * noun ("Admin John"), to "The system", or to the lowercase fallback
 * ("an unidentified user"). Only the last needs lifting, but capitalising the
 * first character unconditionally is safe for all three and avoids the
 * renderer having to know which token happened to land in first position.
 */
function sentenceCase(text) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The single function every read path calls.
 *
 * Returns the row shape the audit table renders, already redacted for the
 * viewer. The caller must have filtered by canViewAction() first -- this
 * function formats, it does not authorise, and passing it an entry the viewer
 * may not see will happily format it.
 *
 * @param {object} entry   a lean audit_logs document
 * @param {'admin'|'superadmin'} viewerRole
 */
function formatAuditEntry(entry, viewerRole) {
  const def = getActionDef(entry.action);
  const isSuper = viewerRole === 'superadmin';
  const context = buildContext(entry, { redactValues: !isSuper });

  // An admin sees the summary only. A superadmin sees the detail line, falling
  // back to the summary for actions that never needed a richer form.
  const message = sentenceCase(
    isSuper
      ? interpolate(def.detail || def.summary, context)
      : interpolate(def.summary, context),
  );

  return {
    id: String(entry._id),
    action: entry.action,
    label: def.label,
    category: def.category,
    severity: def.severity,
    message,
    // Kept as separate columns as well as inside `message`, because the table
    // sorts and filters on them and should not have to re-parse the sentence.
    actor: context.actor,
    actorId: isSuper ? (entry.userId || null) : null,
    actorRole: entry.role || null,
    target: entry.targetId ? context.target : null,
    targetType: entry.targetType || def.targetType || null,
    targetId: isSuper ? (entry.targetId || null) : null,
    ipAddress: isSuper ? (entry.ipAddress || null) : null,
    userAgent: isSuper ? (entry.userAgent || null) : null,
    // Raw before/after values are superadmin-only for the same reason the
    // sentence redacts them; the admin table still gets `changeFields`.
    changes: isSuper && Array.isArray(entry.details?.changes) ? entry.details.changes : null,
    changeFields: context.changeFields || null,
    /**
     * True when the actor/target NAME on this row was filled in later by
     * scripts/backfill-audit-labels.js rather than snapshotted at write time
     * -- so it is today's name, not necessarily the name at the time of the
     * action. Surfaced so the UI can mark the weaker provenance instead of
     * mixing it silently in with properly snapshotted rows.
     */
    labelBackfilled: Boolean(entry.details && entry.details._labelBackfilled),
    createdAt: entry.createdAt,
  };
}

module.exports = {
  AUDIENCES,
  SEVERITIES,
  CATEGORIES,
  AUDIT_ACTIONS,
  getActionDef,
  canViewAction,
  visibleActionsFor,
  formatAuditEntry,
};
