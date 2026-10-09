const crypto = require('crypto');
const { mongoose, opts } = require('../../../config/mongo');
const { CALENDAR_DAY, withId } = require('../shared');
const { today, assertCalendarDay } = require('../../utils/calendarDay');

const { Schema } = mongoose;

// users -- absorbs user_profiles (1:1) and user_goals (bounded history).
// Removes two joins from the hottest path, and registration becomes
// one insert rather than three inside a transaction

// Per-category switches under the master notificationsEnabled. Account
// notices ignore both (services/notifications/notify.js). Quiet hours are "HH:MM" in the
// user's own zone and may cross midnight; null = no quiet hours
const notificationPrefsSchema = new Schema(
  {
    reminders: { type: Boolean, default: true },
    achievements: { type: Boolean, default: true },
    quietStart: { type: String, match: /^\d{2}:\d{2}$/, default: null },
    quietEnd: { type: String, match: /^\d{2}:\d{2}$/, default: null },
  },
  { _id: false },
);

// Same shape as the Workouts filters, but multi-select. wger ids, not checked
// against the catalog: an id that disappears in a sync just matches nothing.
// equipment: null (no preference) | "none" (bodyweight) | "any" (needs some,
// narrowed to equipmentIds when there are any)
const workoutPrefsSchema = new Schema(
  {
    categoryIds: { type: [Number], default: [] },
    equipment: { type: String, enum: ['none', 'any', null], default: null },
    equipmentIds: { type: [Number], default: [] },
  },
  { _id: false },
);

// Sync with profileValidators.js and the frontend's goalOptions.js
const COACH_TONES = ['friendly', 'direct', 'motivational'];

const profileSchema = new Schema(
  {
    // Same 13-122 as authValidators.js
    age: { type: Number, min: 13, max: 122 },
    ageRecordedOn: CALENDAR_DAY,
    sex: { type: String, enum: ['male', 'female', null], default: null },
    heightCm: { type: Number, min: 0, max: 300 },
    // Known option or custom text ("Other"), 50 chars max
    activityLevel: { type: String, maxlength: 50 },
    // Comma-joined multi-select ("High Protein, Low Carb"), like healthConditions
    dietPreference: { type: String },
    healthConditions: { type: String, default: null },

    theme: { type: String, enum: ['system', 'light', 'dark'], default: 'system' },
    notificationsEnabled: { type: Boolean, default: true },
    notificationPrefs: { type: notificationPrefsSchema, default: () => ({}) },
    timezone: { type: String, maxlength: 50 },

    // Storage key rather than a URL
    avatarStorageKey: { type: String, default: null },

    // No external-integration structure and three simple fields
    // since no token or external account ID are needed, unlike Google OAuth
    stepSource: {
      type: String,
      enum: ['healthkit', 'health_connect', 'device_sensor', null],
      default: null,
    },
    stepPermissionAt: { type: Date, default: null },
    lastStepSyncAt: { type: Date, default: null },

    // Set by the setup wizard and editable from Profile / Settings. All
    // optional: null (or empty lists) means "no preference"
    workoutPrefs: { type: workoutPrefsSchema, default: () => ({}) },
    targetWeightKg: { type: Number, min: 20, max: 500, default: null },
    weeklyPaceKg: { type: Number, min: 0.1, max: 1, default: null },
    coachTone: { type: String, enum: [...COACH_TONES, null], default: null },
    // When the setup wizard was finished or skipped. null = not shown yet
    onboardedAt: { type: Date, default: null },
  },
  { _id: false },
);

// A user changes their goal only a handful of times, taking into
// consideration the 16MB document ceiling for embeedded documents.
// Anything writing goals programmatically (auto-adjusted targets)
// would make this unbounded, and it'd need its own collection then
const goalSchema = new Schema(
  {
    fitnessGoal: { type: String, maxlength: 50, default: null },
    dailyCaloriesKcal: { type: Number, default: null },
    dailyProteinG: { type: Number, default: null },
    dailyCarbsG: { type: Number, default: null },
    dailyFatG: { type: Number, default: null },
    dailyWaterMl: { type: Number, default: null },
    dailySteps: { type: Number, default: null },

    // Calendar details are supplied by the client
    effectiveFrom: { ...CALENDAR_DAY, required: true },
    effectiveUntil: { ...CALENDAR_DAY, default: null },
  },
  { _id: false },
);

const userSchema = new Schema(
  {

    // UUID, not Mongo's ObjectId. Three things that depend on it:
    //    * issued JWTs carry it as "sub" or subject
    //    * avatar filenames on disk
    //    * frontend route params and authStorage circles it as a string
    _id: { type: String, default: () => crypto.randomUUID() },

    email: { type: String, required: true, maxlength: 255 },
    passwordHash: { type: String, default: null }, // null for OAuth-only accounts
    fullName: { type: String, maxlength: 150, default: null },
    firstName: { type: String, maxlength: 75, default: null },
    lastName: { type: String, maxlength: 75, default: null },

    // Order is load bearing, used by callers. Should be kept as is
    // Closed enum rather than a string since they carry signed tokens
    // Sync with authMiddleware.js, and Authcontext.js in the frontend
    role: {
      type: String,
      enum: ['user', 'admin', 'superadmin'],
      default: 'user',
      required: true,
    },

    emailVerifiedAt: { type: Date, default: null },

    // Unverified accounts only. The TTL index (migration 001) deletes the account at
    // this time; verifying the email unsets it (and pendingWeightKg)
    unverifiedExpiresAt: { type: Date, default: undefined },
    // Sign-up weight, held here until verification writes the first weight log
    pendingWeightKg: { type: Number, default: undefined },
    termsAcceptedAt: { type: Date, default: null },
    createdAt: { type: Date, default: () => new Date() },

    // Set by an admin. A suspended account can't sign in or refresh a session
    suspendedAt: { type: Date, default: null },
    suspendedReason: { type: String, maxlength: 300, default: null },
    // Set by an admin's forced reset. Sign-in is refused until the user
    // resets through Forgot password, which clears it (updatePasswordHash)
    passwordResetRequiredAt: { type: Date, default: null },

    profile: { type: profileSchema, default: () => ({}) },
    goals: { type: [goalSchema], default: [] },
  },
  { versionKey: false, collection: 'users' },
);

// Indexes are created by migrations/001_nutrifitai.js, not declared here

// ===========================================================================
// Helpers, taking a plain (lean) user
// ===========================================================================

// Fields never sent anywhere. Applied here, not per caller
const PRIVATE_FIELDS = '-passwordHash';

// Keys callers may write to the profile, mapped to the stored path.
// A whitelist, so { role: 'admin' } or a passwordHash can't slip through.
// Step fields only reachable by stepsController, the profile validator
// is .strict() and rejects them
const PROFILE_FIELDS = {
  age: 'profile.age',
  sex: 'profile.sex',
  heightCm: 'profile.heightCm',
  activityLevel: 'profile.activityLevel',
  dietPreference: 'profile.dietPreference',
  healthConditions: 'profile.healthConditions',
  timezone: 'profile.timezone',
  avatarStorageKey: 'profile.avatarStorageKey',
  theme: 'profile.theme',
  notificationsEnabled: 'profile.notificationsEnabled',
  notificationPrefs: 'profile.notificationPrefs',
  workoutPrefs: 'profile.workoutPrefs',
  targetWeightKg: 'profile.targetWeightKg',
  weeklyPaceKg: 'profile.weeklyPaceKg',
  coachTone: 'profile.coachTone',
  onboardedAt: 'profile.onboardedAt',

  stepSource: 'profile.stepSource',
  stepPermissionAt: 'profile.stepPermissionAt',
  lastStepSyncAt: 'profile.lastStepSyncAt',
};

// Numeric targets carried over when only the goal itself changes
const GOAL_TARGETS = [
  'dailyCaloriesKcal', 'dailyProteinG', 'dailyCarbsG', 'dailyFatG',
  'dailyWaterMl', 'dailySteps',
];

// Neutralises regex metacharacters in admin search input. "a(" would throw
// and "(a+)+$" is a catastrophic-backtracking hang otherwise
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The active goal is the one with no end date
userSchema.statics.activeGoalOf = function activeGoalOf(goals) {
  if (!Array.isArray(goals)) return null;
  return goals.find((g) => g.effectiveUntil === null || g.effectiveUntil === undefined) || null;
};

// Name snapshotted onto audit entries and shown across the admin UI
userSchema.statics.displayName = function displayName(user) {
  if (!user) return null;
  return user.fullName || user.email || null;
};

// null when there's no user to judge, rather than a false "unverified"
userSchema.statics.isVerified = function isVerified(user) {
  return user ? Boolean(user.emailVerifiedAt) : null;
};

// What the client's AuthContext holds. Nothing private goes past this
userSchema.statics.toAuthPayload = function toAuthPayload(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    emailVerified: Boolean(user.emailVerifiedAt),
    role: user.role || 'user',
  };
};

// ===========================================================================
// Account
// ===========================================================================

// Emails are lowercased on every read and write, the unique index being
// case-sensitive makes this THE case-insensitivity
userSchema.statics.findByEmail = async function findByEmail(email, client) {
  return withId(await this.findOne({ email: email.toLowerCase() }, null, opts(client)).lean());
};

// get*, not find*: Model.findById is Mongoose's own and still used natively
userSchema.statics.getById = async function getById(id, client) {
  return withId(await this.findById(id, null, opts(client)).lean());
};

// Same as getById, but the hash never leaves the model
userSchema.statics.getByIdSafe = async function getByIdSafe(id, client) {
  return withId(await this.findById(id, PRIVATE_FIELDS, opts(client)).lean());
};

// User, profile and initial goal in one insert. No window where
// a user exists without a profile
userSchema.statics.createAccount = async function createAccount(input, client) {
  const [doc] = await this.create(
    [
      {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        fullName: input.fullName || null,
        firstName: input.firstName || null,
        lastName: input.lastName || null,
        termsAcceptedAt: input.termsAcceptedAt || null,
        unverifiedExpiresAt: input.unverifiedExpiresAt,
        pendingWeightKg: input.pendingWeightKg,
        createdAt: new Date(),
        profile: input.profile || {},
        goals: input.initialGoal ? [input.initialGoal] : [],
      },
    ],
    opts(client),
  );
  return withId(doc.toObject());
};

// All three written together so fullName can't drift from first/last
userSchema.statics.updateNames = async function updateNames(id, names, client) {
  return withId(
    await this.findByIdAndUpdate(
      id,
      {
        $set: {
          fullName: names.fullName || null,
          firstName: names.firstName || null,
          lastName: names.lastName || null,
        },
      },
      { new: true, runValidators: true, ...opts(client) },
    ).lean(),
  );
};

// Also clears the TTL deadline and the held sign-up weight. Returns the
// document as it was BEFORE the update, so the caller can read pendingWeightKg
userSchema.statics.markEmailVerified = async function markEmailVerified(id, client) {
  return withId(
    await this.findByIdAndUpdate(
      id,
      {
        $set: { emailVerifiedAt: new Date() },
        $unset: { unverifiedExpiresAt: '', pendingWeightKg: '' },
      },
      { new: false, ...opts(client) },
    ).lean(),
  );
};

// Re-registration of an unverified account: new deadline and held weight
userSchema.statics.updatePendingRegistration = async function updatePendingRegistration(
  id,
  { unverifiedExpiresAt, pendingWeightKg },
  client,
) {
  await this.updateOne(
    { _id: id, emailVerifiedAt: null },
    { $set: { unverifiedExpiresAt, pendingWeightKg } },
    opts(client),
  );
};

userSchema.statics.updatePasswordHash = async function updatePasswordHash(id, passwordHash, client) {
  return withId(
    await this.findByIdAndUpdate(
      id,
      { $set: { passwordHash, passwordResetRequiredAt: null } },
      { new: true, ...opts(client) },
    ).lean(),
  );
};

// Two primary-key lookups rather than a $lookup. The identity side is
// unique-indexed and returns at most one document anyway
userSchema.statics.findByProviderIdentity = async function findByProviderIdentity(
  provider,
  providerSubject,
  client,
) {
  const identity = await mongoose
    .model('AuthIdentity')
    .findOne({ provider, providerSubject }, 'userId', opts(client))
    .lean();
  if (!identity) return null;
  return this.getById(identity.userId, client);
};

// ===========================================================================
// Profile (embedded)
// ===========================================================================

userSchema.statics.getProfile = async function getProfile(userId, client) {
  const doc = await this.findById(userId, 'profile', opts(client)).lean();
  return doc ? doc.profile || {} : null;
};

// Partial update: only keys present in `changes` are written. An explicit
// null DOES clear a field ("Health Conditions: none"), hence hasOwnProperty.
// Returns the current profile when there's nothing to write
userSchema.statics.updateProfile = async function updateProfile(userId, changes, client) {
  const $set = {};
  for (const [key, path] of Object.entries(PROFILE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) $set[path] = changes[key];
  }

  // ageRecordedOn moves with age so it can be aged forward later. A calendar
  // day in the user's own timezone, never new Date()
  if (Object.prototype.hasOwnProperty.call(changes, 'age')) {
    if (changes.age === null) {
      $set['profile.ageRecordedOn'] = null;
    } else {
      const tz = changes.timezone ?? (await this.getProfile(userId, client))?.timezone;
      $set['profile.ageRecordedOn'] = today(tz);
    }
  }

  if (Object.keys($set).length === 0) return this.getProfile(userId, client);

  const doc = await this.findByIdAndUpdate(
    userId,
    { $set },
    { new: true, runValidators: true, projection: 'profile', ...opts(client) },
  ).lean();
  return doc ? doc.profile : null;
};

userSchema.statics.updateAvatar = async function updateAvatar(userId, avatarStorageKey, client) {
  const doc = await this.findByIdAndUpdate(
    userId,
    { $set: { 'profile.avatarStorageKey': avatarStorageKey } },
    { new: true, projection: 'profile', ...opts(client) },
  ).lean();
  return doc ? doc.profile : null;
};

// ===========================================================================
// Goals (embedded, append-only history)
// ===========================================================================

// First goal for an account created without one. Registration normally
// passes initialGoal to createAccount instead
userSchema.statics.addInitialGoal = async function addInitialGoal(input, client) {
  const effectiveFrom = input.effectiveFrom
    ? assertCalendarDay(input.effectiveFrom, 'effectiveFrom')
    : today((await this.getProfile(input.userId, client))?.timezone);

  const entry = { fitnessGoal: input.fitnessGoal, effectiveFrom, effectiveUntil: null };
  for (const key of GOAL_TARGETS) entry[key] = null;

  await this.updateOne(
    { _id: input.userId },
    { $push: { goals: entry } },
    { runValidators: true, ...opts(client) },
  );
  return entry;
};

userSchema.statics.getActiveGoal = async function getActiveGoal(userId, client) {
  const doc = await this.findById(userId, 'goals', opts(client)).lean();
  return doc ? this.activeGoalOf(doc.goals) : null;
};

// Closes the open entry and opens a new one, carrying the numeric targets
// forward. effectiveFrom is the user's own calendar day, not the server's.
// No-op when the goal didn't change, so saving height doesn't add an entry
userSchema.statics.setActiveGoal = async function setActiveGoal(input, client) {
  const doc = await this.findById(input.userId, 'goals profile.timezone', opts(client)).lean();
  if (!doc) return null;

  const goals = Array.isArray(doc.goals) ? doc.goals : [];
  const current = this.activeGoalOf(goals);
  if (current && current.fitnessGoal === input.fitnessGoal) return current;

  const effectiveFrom = input.effectiveFrom
    ? assertCalendarDay(input.effectiveFrom, 'effectiveFrom')
    : today(doc.profile?.timezone);

  const next = { fitnessGoal: input.fitnessGoal, effectiveFrom, effectiveUntil: null };
  for (const key of GOAL_TARGETS) next[key] = current?.[key] ?? null;

  /* Close and append as ONE write of the whole array. $set on goals.$[open]
     and $push on goals in the same update is a path conflict Mongo rejects,
     and two updates leave a moment with no active goal. The $size filter
     makes it fail rather than overwrite if another save got there first */
  const closed = goals.map((g) => (g === current ? { ...g, effectiveUntil: effectiveFrom } : g));
  await this.updateOne(
    { _id: input.userId, goals: { $size: goals.length } },
    { $set: { goals: [...closed, next] } },
    { runValidators: true, ...opts(client) },
  );
  return next;
};

// Changes numeric targets ({ dailyWaterMl: 2500, dailySteps: 8000 }) on the
// active goal, in place and in one write. Targets aren't history the way the
// goal itself is, so no new entry. A user without an active goal gets one
// opened for today
userSchema.statics.setGoalTargets = async function setGoalTargets(userId, targets, client) {
  const $set = {};
  for (const [field, value] of Object.entries(targets)) {
    if (!GOAL_TARGETS.includes(field)) throw new Error(`${field} is not a goal target`);
    $set[`goals.$[open].${field}`] = value;
  }
  if (Object.keys($set).length === 0) return this.getActiveGoal(userId, client);

  const { modifiedCount, matchedCount } = await this.updateOne(
    { _id: userId },
    { $set },
    {
      arrayFilters: [{ $or: [{ 'open.effectiveUntil': null }, { 'open.effectiveUntil': { $exists: false } }] }],
      runValidators: true,
      ...opts(client),
    },
  );
  if (!matchedCount) return null;

  if (!modifiedCount && !(await this.getActiveGoal(userId, client))) {
    await this.addInitialGoal({ userId, fitnessGoal: null }, client);
    return this.setGoalTargets(userId, targets, client);
  }
  return this.getActiveGoal(userId, client);
};

// One target, for the single-goal cards (water, steps, nutrition)
userSchema.statics.setGoalTarget = async function setGoalTarget(userId, field, value, client) {
  return this.setGoalTargets(userId, { [field]: value }, client);
};

// True while the setup wizard's answers are all still empty, for the
// dashboard's "Finish setting up" banner
userSchema.statics.isSetupPending = function isSetupPending(profile, goal) {
  const prefs = profile?.workoutPrefs;
  const hasPrefs = Boolean(prefs?.categoryIds?.length || prefs?.equipment || prefs?.equipmentIds?.length);
  const hasTargets = GOAL_TARGETS.some((key) => goal?.[key] != null);
  return !hasPrefs && !hasTargets && profile?.targetWeightKg == null && !profile?.coachTone;
};

// Full history, newest first, for the progress screens
userSchema.statics.listGoals = async function listGoals(userId, client) {
  const doc = await this.findById(userId, 'goals', opts(client)).lean();
  if (!doc || !Array.isArray(doc.goals)) return [];
  return [...doc.goals].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
};

// ===========================================================================
// Admin surface
// ===========================================================================

// Regex search rather than a text index: users already spends its index
// budget, and this is an admin directory, not a hot path
userSchema.statics.listPaginated = async function listPaginated(query = {}, client) {
  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  const page = Math.max(Number(query.page) || 1, 1);

  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.search) {
    const pattern = escapeRegex(query.search.trim());
    if (pattern) {
      filter.$or = [
        { email: { $regex: pattern, $options: 'i' } },
        { fullName: { $regex: pattern, $options: 'i' } },
      ];
    }
  }

  const run = (f) => Promise.all([
    // users_recent covers the sort. Uncovered, Atlas M0 fails past 32 MB
    this.find(f, PRIVATE_FIELDS, opts(client))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    this.countDocuments(f, opts(client)),
  ]);

  let [docs, total] = await run(filter);

  // Name and email first. Only when neither matches does a full user id
  // (UUID) get looked up, as an exact match on _id
  const term = query.search?.trim();
  if (!total && term && UUID_RE.test(term)) {
    [docs, total] = await run({ ...(query.role ? { role: query.role } : {}), _id: term.toLowerCase() });
  }

  return {
    rows: docs.map(withId),
    page,
    limit,
    total,
    pageCount: Math.max(Math.ceil(total / limit), 1),
  };
};

// One aggregation for the headline cards, not three counts
userSchema.statics.countByRole = async function countByRole(client) {
  const rows = await this.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }])
    .session(opts(client).session || null);

  return rows.reduce((acc, row) => {
    acc[row._id || 'user'] = row.count;
    return acc;
  }, {});
};

// Who may grant what is decided in controllers/admin/usersController, not here. runValidators
// keeps a typo'd role from slipping past the enum
userSchema.statics.updateRole = async function updateRole(id, role, client) {
  return withId(
    await this.findByIdAndUpdate(
      id,
      { $set: { role } },
      { new: true, runValidators: true, fields: PRIVATE_FIELDS, ...opts(client) },
    ).lean(),
  );
};

// null clears it (reinstate). Returns the updated user, without the hash
userSchema.statics.setSuspension = async function setSuspension(id, reason, client) {
  const update = reason
    ? { suspendedAt: new Date(), suspendedReason: reason }
    : { suspendedAt: null, suspendedReason: null };
  return withId(
    await this.findByIdAndUpdate(id, { $set: update }, { new: true, fields: PRIVATE_FIELDS, ...opts(client) }).lean(),
  );
};

userSchema.statics.requirePasswordReset = async function requirePasswordReset(id, client) {
  return withId(
    await this.findByIdAndUpdate(
      id,
      { $set: { passwordResetRequiredAt: new Date() } },
      { new: true, fields: PRIVATE_FIELDS, ...opts(client) },
    ).lean(),
  );
};

// Undoes requirePasswordReset: the old password works again
userSchema.statics.cancelPasswordReset = async function cancelPasswordReset(id, client) {
  return withId(
    await this.findByIdAndUpdate(
      id,
      { $set: { passwordResetRequiredAt: null } },
      { new: true, fields: PRIVATE_FIELDS, ...opts(client) },
    ).lean(),
  );
};

module.exports = mongoose.model('User', userSchema);