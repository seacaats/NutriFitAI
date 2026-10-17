// Turns a stored audit_logs row into the sentence and fields the audit table
// renders, redacted for the viewer. The action definitions live in registry.js

const { AUDIT_ACTIONS, getActionDef } = require('./registry');

// ===========================================================================
// Values
// ===========================================================================

// Stored codes as people read them. One map for every field: a code means
// the same thing wherever it appears. Anything not listed is humanised
// (snake_case -> "Snake case"), which is right for free text and goal names
const LABELS = {
  // sign-in methods and providers
  password: 'Password',
  google: 'Google',
  ollama: 'Ollama',
  groq: 'Groq',
  // step sources
  healthkit: 'Apple Health',
  health_connect: 'Health Connect',
  device_sensor: 'Phone sensor',
  none: 'None',
  // sign-in and session reasons
  unknown_email: 'Unknown email',
  wrong_password: 'Wrong password',
  unverified: 'Email not verified',
  suspended: 'Account suspended',
  reset_required: 'Password reset required',
  expired: 'Session expired',
  invalid: 'Invalid session token',
  account_missing: 'Account no longer exists',
  session_ceiling: 'Session reached its 30-day limit',
  // coach
  rate_limited: 'Rate limited',
  provider_error: 'Provider error',
  daily: 'Daily',
  burst: 'Per-minute',
  // audit chain (one per severity) and its problems
  info: 'Routine',
  notice: 'Notable',
  warning: 'Warnings',
  critical: 'Critical',
  'row edited': 'A row was edited',
  'row missing': 'A row is missing',
  'link mismatch': 'Rows are out of order',
  // roles and platforms
  user: 'User',
  admin: 'Admin',
  superadmin: 'Superadmin',
  ios: 'iOS',
  android: 'Android',
  web: 'Web',
};

function humanize(value) {
  const text = String(value).replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function label(value) {
  return LABELS[value] ?? humanize(value);
}

// In a sentence, a proper noun keeps its capitals ("Apple Health") and
// anything else reads lowercase ("changed their goal to lose weight")
function inSentence(value) {
  if (typeof value !== 'string') return value;
  return LABELS[value] ?? value.replace(/_/g, ' ');
}

// Rows deleted with an account, by accountDeletion's collection keys
const COUNT_NOUNS = {
  users: ['account', 'accounts'],
  meals: ['meal', 'meals'],
  foodScans: ['food scan', 'food scans'],
  waterLogs: ['water entry', 'water entries'],
  weightLogs: ['weight entry', 'weight entries'],
  dailySteps: ['step day', 'step days'],
  workoutSessions: ['workout', 'workouts'],
  workoutRoutines: ['routine', 'routines'],
  favoriteWorkouts: ['favourite', 'favourites'],
  chatConversations: ['coach chat', 'coach chats'],
  chatMessages: ['coach message', 'coach messages'],
  notifications: ['notification', 'notifications'],
  pushTokens: ['device', 'devices'],
  authIdentities: ['linked sign-in', 'linked sign-ins'],
  authChallenges: ['sign-in code', 'sign-in codes'],
};

function counts(value) {
  const parts = Object.entries(value || {})
    .filter(([, n]) => n > 0)
    .map(([key, n]) => {
      const [one, many] = COUNT_NOUNS[key] || [humanize(key).toLowerCase(), humanize(key).toLowerCase()];
      return `${n} ${n === 1 ? one : many}`;
    });
  return parts.length ? parts.join(', ') : 'Nothing';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// A calendar day ("2026-10-04") as "4 Oct 2026". Instants are sent as
// `type: 'datetime'` instead, the client formats them in the reader's zone
function day(value) {
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function range(from, to) {
  if (!from && !to) return 'All time';
  if (from && !to) return `Since ${day(new Date(from).toISOString())}`;
  if (!from && to) return `Until ${day(new Date(to).toISOString())}`;
  return `${day(new Date(from).toISOString())} – ${day(new Date(to).toISOString())}`;
}

// The By User tab's sides, as its buttons name them
const SUBJECT_MODES = { actor: 'as actor', target: 'as target', self: 'self' };

function filters(value) {
  const parts = [];
  if (value.held) parts.push('Held entries');
  if (value.category) parts.push(`Category: ${humanize(value.category)}`);
  if (value.action) parts.push(`Action: ${AUDIT_ACTIONS[value.action]?.label ?? value.action}`);
  // "all" is the default side, so only the narrower ones are named
  if (value.subjectId) {
    const side = value.subjectMode && value.subjectMode !== 'all' ? ` (${SUBJECT_MODES[value.subjectMode]})` : '';
    parts.push(`User ID: ${value.subjectId}${side}`);
  }
  if (value.from || value.to) parts.push(range(value.from, value.to));
  return parts.length ? parts.join(' · ') : 'All entries';
}

// The export's filters, scope first: "Auth (All)", "Auth (Account Created)".
// The rest (held, user, dates) reads the same as on a view
function exportFilters(value) {
  const action = value.action ? AUDIT_ACTIONS[value.action] : null;
  const category = value.category || action?.category;
  const scope = category
    ? `${humanize(category)} (${action ? action.label : 'All'})`
    : null;
  const rest = filters({ ...value, category: null, action: null });
  if (!scope) return rest;
  return rest === 'All entries' ? scope : `${scope} · ${rest}`;
}

// One field of the expanded row, or null when there's nothing to show
function formatField(field, details, entry) {
  if (field.value !== undefined) return { label: field.label, value: field.value };

  const raw = field.key === 'targetId' ? entry.targetId : details[field.key];
  if (raw === undefined || raw === null || raw === '') return null;

  switch (field.format) {
    case 'yesno': return { label: field.label, value: raw ? 'Yes' : 'No' };
    case 'label': return { label: field.label, value: label(raw) };
    case 'counts': return { label: field.label, value: counts(raw) };
    case 'day': return { label: field.label, value: day(raw) };
    case 'filters': return { label: field.label, value: filters(raw) };
    case 'exportFilters': return { label: field.label, value: exportFilters(raw) };
    case 'datetime': return { label: field.label, value: new Date(raw).toISOString(), type: 'datetime' };
    case 'action': return { label: field.label, value: AUDIT_ACTIONS[raw]?.label ?? raw };
    default: return { label: field.label, value: String(raw) };
  }
}

/**
 * Unit suffixes this codebase appends to field names.
 *
 * The convention (heightCm, weightKg, dailyCaloriesKcal, amountMl,
 * actualDurationSeconds) is good for code and terrible read aloud -- "height
 * cm from 170 to 172". Stripping the suffix is preferred to a hand-maintained
 * label map for every audited field, which would silently drift out of sync
 * with the validators the moment a field is added.
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

// ===========================================================================
// Names
// ===========================================================================

/**
 * What to call a party whose NAME is not on the entry.
 *
 * A MISSING LABEL IS NOT EVIDENCE OF DELETION. It happens when a name
 * lookup failed at write time: resolveActor swallows that error and records
 * null rather than losing the entry, so a live user can have no label. The
 * wording falls back to the role, which IS recorded, and says only that the
 * name is not on the entry.
 */
function unnamed(role) {
  return role && LABELS[role] ? `an unidentified ${role}` : 'an unidentified user';
}

// Actor and target read from the SNAPSHOT labels on the document, never a
// live join: a user who later renames, or is deleted, must not rewrite every
// past entry about them. Roles are shown in the drawer, not in the sentence
function names(entry) {
  const selfDirected = entry.targetId && entry.userId && entry.targetId === entry.userId;

  // No userId is a cron job, a script or the retention purge. A system row
  // that names itself (create-admins.js) reads as that name
  const actor = entry.userId
    ? (entry.actorLabel || unnamed(entry.role))
    : (entry.actorLabel || 'The system');

  let target = null;
  if (selfDirected) target = actor;
  else if (entry.targetId) target = entry.targetLabel || unnamed(entry.targetRole);

  return { actor, target };
}

// ===========================================================================
// The row
// ===========================================================================

function article(word) {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

function sentence(template, details, actor, target) {
  const tokens = {
    ...Object.fromEntries(Object.entries(details).map(([k, v]) => [k, inSentence(v)])),
    actor,
    target: target || 'an account',
  };
  if (details.toRole) {
    tokens.toRole = details.toRole;
    tokens.toRoleWithArticle = article(details.toRole);
  }
  // A goal cleared to null reads "none" rather than "null"
  const text = template.replace(/\{(\w+)\}/g, (match, key) => String(tokens[key] ?? 'none'));
  // Only the unnamed fallback starts lowercase. A label never gets lifted,
  // that would misspell a file path ("scripts/create-admins.js")
  return text.startsWith('an unidentified') ? `A${text.slice(1)}` : text;
}

/**
 * The single function every read path calls.
 *
 * Returns the row shape the audit table renders, already redacted for the
 * viewer. The caller must have filtered by canViewAction() first -- this
 * function formats, it does not authorise, and passing it an entry the viewer
 * may not see will happily format it.
 *
 * One sentence for every viewer. Everything a superadmin sees beyond an
 * admin -- IDs, IP, user agent, before/after values, superadmin-only fields
 * -- rides in its own field, never in the sentence.
 *
 * @param {object} entry   a lean audit_logs document
 * @param {'admin'|'superadmin'} viewerRole
 */
function formatAuditEntry(entry, viewerRole) {
  const def = getActionDef(entry.action);
  const isSuper = viewerRole === 'superadmin';
  const details = (entry.details && typeof entry.details === 'object') ? entry.details : {};
  const { actor, target } = names(entry);

  const fields = def.fields
    .filter((field) => isSuper || !field.superadmin)
    .map((field) => formatField(field, details, entry))
    .filter(Boolean);

  const changes = Array.isArray(details.changes) ? details.changes : [];

  return {
    id: String(entry._id),
    action: entry.action,
    label: def.label,
    category: def.category,
    severity: def.severity,
    message: sentence(def.message, details, actor, target),
    fields,
    actor,
    actorId: isSuper ? (entry.userId || null) : null,
    actorRole: entry.role || null,
    // false only when the actor was unverified at the time ("User (Unverified)")
    actorVerified: entry.actorVerified ?? null,
    target,
    targetRole: entry.targetRole || null,
    targetType: entry.targetType || def.targetType || null,
    targetId: isSuper ? (entry.targetId || null) : null,
    ipAddress: isSuper ? (entry.ipAddress || null) : null,
    userAgent: isSuper ? (entry.userAgent || null) : null,
    // Before/after values are superadmin-only. Health fields carry neither
    // (see HEALTH_FIELDS), so they come through as hidden
    changes: isSuper && changes.length
      ? changes.map((c) => ({
        field: c.field,
        label: humanize(humanField(c.field)),
        from: c.from ?? null,
        to: c.to ?? null,
        hidden: !('from' in c) && !('to' in c),
      }))
      : null,
    // The admin view: which fields moved, without their values
    changeFields: changes.length ? humanize(joinList(changes.map((c) => humanField(c.field)))) : null,
    createdAt: entry.createdAt,
    // When TTL deletes the row. The table flags rows close to it
    expiresAt: entry.expiresAt || null,
  };
}

module.exports = { formatAuditEntry };