const crypto = require('crypto');
const { mongoose, opts } = require('../../../config/mongo');
const { CALENDAR_DAY, withId } = require('../shared');
const { today, assertCalendarDay } = require('../../utils/calendarDay');

const { Schema } = mongoose;

// Per-category switches under notificationsEnabled (account notices bypass both).
// Quiet hours ("HH:MM" in local timezone) may cross midnight; null disables them.
const notificationPrefsSchema = new Schema(
  {
    reminders: { type: Boolean, default: true },
    achievements: { type: Boolean, default: true },
    quietStart: { type: String, match: /^\d{2}:\d{2}$/, default: null },
    quietEnd: { type: String, match: /^\d{2}:\d{2}$/, default: null },
  },
  { _id: false },
);

// Workout catalog preference filters (equipment: null | "none" | "any")
const workoutPrefsSchema = new Schema(
  {
    categoryIds: { type: [Number], default: [] },
    equipment: { type: String, enum: ['none', 'any', null], default: null },
    equipmentIds: { type: [Number], default: [] },
    muscleIds: { type: [Number], default: [] },
    secondaryMuscleIds: { type: [Number], default: [] },
  },
  { _id: false },
);

const COACH_TONES = ['friendly', 'direct', 'motivational'];

const profileSchema = new Schema(
  {
    age: { type: Number, min: 13, max: 122 },
    ageRecordedOn: CALENDAR_DAY,
    sex: { type: String, enum: ['male', 'female', null], default: null },
    heightCm: { type: Number, min: 0, max: 300 },
    activityLevel: { type: String, maxlength: 50 },
    dietPreference: { type: String },
    healthConditions: { type: String, default: null },

    notificationsEnabled: { type: Boolean, default: true },
    notificationPrefs: { type: notificationPrefsSchema, default: () => ({}) },
    timezone: { type: String, maxlength: 50 },

    avatarStorageKey: { type: String, default: null },

    stepSource: {
      type: String,
      enum: ['healthkit', 'health_connect', 'device_sensor', null],
      default: null,
    },
    stepPermissionAt: { type: Date, default: null },
    lastStepSyncAt: { type: Date, default: null },

    workoutPrefs: { type: workoutPrefsSchema, default: () => ({}) },
    targetWeightKg: { type: Number, min: 20, max: 500, default: null },
    weeklyPaceKg: { type: Number, min: 0.1, max: 1, default: null },
    coachTone: { type: String, enum: [...COACH_TONES, null], default: null },
    onboardedAt: { type: Date, default: null },
  },
  { _id: false },
);

const goalSchema = new Schema(
  {
    fitnessGoal: { type: String, maxlength: 50, default: null },
    dailyCaloriesKcal: { type: Number, default: null },
    dailyProteinG: { type: Number, default: null },
    dailyCarbsG: { type: Number, default: null },
    dailyFatG: { type: Number, default: null },
    dailyWaterMl: { type: Number, default: null },
    dailySteps: { type: Number, default: null },

    effectiveFrom: { ...CALENDAR_DAY, required: true },
    effectiveUntil: { ...CALENDAR_DAY, default: null },
  },
  { _id: false },
);

// Two-factor authentication state (encrypted TOTP secret and hashed recovery codes)
const mfaSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    secretEnc: { type: String, default: null },
    pendingSecretEnc: { type: String, default: null },
    pendingExpiresAt: { type: Date, default: null },
    recoveryHashes: { type: [String], default: [] },
    // Latest accepted TOTP step to prevent replay
    lastUsedStep: { type: Number, default: 0 },
    failedAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    enabledAt: { type: Date, default: null },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    // String UUID used across JWT sub claims, storage keys, and client routes
    _id: { type: String, default: () => crypto.randomUUID() },

    email: { type: String, required: true, maxlength: 255 },
    passwordHash: { type: String, default: null },
    fullName: { type: String, maxlength: 150, default: null },
    firstName: { type: String, maxlength: 75, default: null },
    lastName: { type: String, maxlength: 75, default: null },

    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      required: true,
    },

    emailVerifiedAt: { type: Date, default: null },
    pendingEmail: { type: String, maxlength: 255, default: null },
    pendingEmailExpiresAt: { type: Date, default: null },
    emailChangedAt: { type: Date, default: null },

    // Unset once verified; drives the unverified-account TTL index
    unverifiedExpiresAt: { type: Date, default: undefined },
    // Initial weight held until email verification logs it
    pendingWeightKg: { type: Number, default: undefined },
    termsAcceptedAt: { type: Date, default: null },
    createdAt: { type: Date, default: () => new Date() },

    suspendedAt: { type: Date, default: null },
    suspendedReason: { type: String, maxlength: 300, default: null },
    suspendedBy: { type: String, maxlength: 150, default: null },
    suspendedUserMessage: { type: String, maxlength: 300, default: null },
    deletionScheduledFor: { type: Date, default: null },
    passwordResetRequiredAt: { type: Date, default: null },
    passwordResetRequiredReason: { type: String, maxlength: 300, default: null },
    passwordResetRequiredBy: { type: String, maxlength: 150, default: null },

    mfa: { type: mfaSchema, default: () => ({}) },

    profile: { type: profileSchema, default: () => ({}) },
    goals: { type: [goalSchema], default: [] },
  },
  { versionKey: false, collection: 'users' },
);

// ===========================================================================
// Helpers
// ===========================================================================

const PRIVATE_FIELDS = '-passwordHash -mfa.secretEnc -mfa.pendingSecretEnc -mfa.recoveryHashes';

// Allowed profile update keys mapped to their document paths
const PROFILE_FIELDS = {
  age: 'profile.age',
  sex: 'profile.sex',
  heightCm: 'profile.heightCm',
  activityLevel: 'profile.activityLevel',
  dietPreference: 'profile.dietPreference',
  healthConditions: 'profile.healthConditions',
  timezone: 'profile.timezone',
  avatarStorageKey: 'profile.avatarStorageKey',
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

const GOAL_TARGETS = [
  'dailyCaloriesKcal', 'dailyProteinG', 'dailyCarbsG', 'dailyFatG',
  'dailyWaterMl', 'dailySteps',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

userSchema.statics.activeGoalOf = function activeGoalOf(goals) {
  if (!Array.isArray(goals)) return null;
  return goals.find((g) => g.effectiveUntil === null || g.effectiveUntil === undefined) || null;
};

userSchema.statics.displayName = function displayName(user) {
  if (!user) return null;
  return user.fullName || user.email || null;
};

userSchema.statics.isVerified = function isVerified(user) {
  return user ? Boolean(user.emailVerifiedAt) : null;
};

userSchema.statics.toAuthPayload = function toAuthPayload(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    emailVerified: Boolean(user.emailVerifiedAt),
    role: user.role || 'user',
    mfaEnabled: Boolean(user.mfa && user.mfa.enabled),
  };
};

// ===========================================================================
// Account
// ===========================================================================

userSchema.statics.findByEmail = async function findByEmail(email, client) {
  return withId(await this.findOne({ email: email.toLowerCase() }, null, opts(client)).lean());
};

userSchema.statics.getById = async function getById(id, client) {
  return withId(await this.findById(id, null, opts(client)).lean());
};

userSchema.statics.getByIdSafe = async function getByIdSafe(id, client) {
  return withId(await this.findById(id, PRIVATE_FIELDS, opts(client)).lean());
};

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
        emailVerifiedAt: input.emailVerifiedAt || null,
        passwordResetRequiredAt: input.passwordResetRequiredAt || null,
        passwordResetRequiredReason: input.passwordResetRequiredReason || null,
        passwordResetRequiredBy: input.passwordResetRequiredBy || null,
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

// Clear unverified TTL and pending weight; returns the pre-update document
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

userSchema.statics.updatePendingRegistration = async function updatePendingRegistration(
  id,
  { unverifiedExpiresAt, pendingWeightKg },
  client,
) {
  await this.updateOne(
    { _id: id, emailVerifiedAt: null },
    { $set: { unverifiedExpiresAt, pendingWeightKg, termsAcceptedAt: new Date() } },
    opts(client),
  );
};

userSchema.statics.updatePasswordHash = async function updatePasswordHash(id, passwordHash, client) {
  return withId(
    await this.findByIdAndUpdate(
      id,
      { $set: { passwordHash, passwordResetRequiredAt: null, passwordResetRequiredReason: null, passwordResetRequiredBy: null } },
      { new: true, ...opts(client) },
    ).lean(),
  );
};

userSchema.statics.setPendingEmail = async function setPendingEmail(id, email, expiresAt, client) {
  await this.updateOne(
    { _id: id },
    { $set: { pendingEmail: email.toLowerCase(), pendingEmailExpiresAt: expiresAt } },
    opts(client),
  );
};

// Atomically apply a non-expired pending email; returns the pre-update document
userSchema.statics.applyPendingEmail = async function applyPendingEmail(id, client) {
  return withId(
    await this.findOneAndUpdate(
      { _id: id, pendingEmail: { $ne: null }, pendingEmailExpiresAt: { $gt: new Date() } },
      [{ $set: { email: '$pendingEmail', emailChangedAt: new Date(), pendingEmail: null, pendingEmailExpiresAt: null } }],
      { new: false, ...opts(client) },
    ).lean(),
  );
};

// ===========================================================================
// Two-factor sign-in
// ===========================================================================

const MFA_SETUP_MS = 10 * 60 * 1000;

userSchema.statics.startMfaSetup = async function startMfaSetup(id, secretEnc, client) {
  await this.updateOne(
    { _id: id, 'mfa.secretEnc': null },
    { $set: { 'mfa.pendingSecretEnc': secretEnc, 'mfa.pendingExpiresAt': new Date(Date.now() + MFA_SETUP_MS) } },
    opts(client),
  );
};

userSchema.statics.enableMfa = async function enableMfa(id, { secretEnc, recoveryHashes, step }, client) {
  const result = await this.updateOne(
    { _id: id, 'mfa.secretEnc': null },
    {
      $set: {
        mfa: {
          enabled: true,
          secretEnc,
          pendingSecretEnc: null,
          pendingExpiresAt: null,
          recoveryHashes,
          lastUsedStep: step,
          failedAttempts: 0,
          lockedUntil: null,
          enabledAt: new Date(),
        },
      },
    },
    opts(client),
  );
  return result.modifiedCount === 1;
};

// Clear TOTP secret and recovery codes while keeping MFA enabled to force re-setup on next sign-in
userSchema.statics.resetAuthenticator = async function resetAuthenticator(id, client) {
  return withId(
    await this.findByIdAndUpdate(
      id,
      {
        $set: {
          mfa: {
            enabled: true,
            secretEnc: null,
            pendingSecretEnc: null,
            pendingExpiresAt: null,
            recoveryHashes: [],
            lastUsedStep: 0,
            failedAttempts: 0,
            lockedUntil: null,
            enabledAt: null,
          },
        },
      },
      { new: true, fields: PRIVATE_FIELDS, ...opts(client) },
    ).lean(),
  );
};

userSchema.statics.setEmailMfa = async function setEmailMfa(id, enabled, client) {
  await this.updateOne(
    { _id: id },
    { $set: { 'mfa.enabled': enabled, 'mfa.enabledAt': enabled ? new Date() : null } },
    opts(client),
  );
};

userSchema.statics.replaceRecoveryHashes = async function replaceRecoveryHashes(id, recoveryHashes, client) {
  await this.updateOne({ _id: id, 'mfa.enabled': true }, { $set: { 'mfa.recoveryHashes': recoveryHashes } }, opts(client));
};

userSchema.statics.countRecoveryCodes = async function countRecoveryCodes(id, client) {
  const doc = await this.findById(id, 'mfa.recoveryHashes', opts(client)).lean();
  return doc?.mfa?.recoveryHashes?.length ?? 0;
};

// Atomically advance lastUsedStep so a TOTP code cannot be replayed
userSchema.statics.claimTotpStep = async function claimTotpStep(id, step, client) {
  const result = await this.updateOne(
    { _id: id, 'mfa.lastUsedStep': { $lt: step } },
    { $set: { 'mfa.lastUsedStep': step } },
    opts(client),
  );
  return result.modifiedCount === 1;
};

userSchema.statics.consumeRecoveryHash = async function consumeRecoveryHash(id, hash, client) {
  const result = await this.updateOne(
    { _id: id, 'mfa.recoveryHashes': hash },
    { $pull: { 'mfa.recoveryHashes': hash } },
    opts(client),
  );
  return result.modifiedCount === 1;
};

userSchema.statics.recordMfaFailure = async function recordMfaFailure(id, { max, lockMs }, client) {
  const updated = await this.findByIdAndUpdate(
    id,
    { $inc: { 'mfa.failedAttempts': 1 } },
    { new: true, fields: 'mfa.failedAttempts', ...opts(client) },
  ).lean();
  if (!updated || updated.mfa.failedAttempts < max) return null;

  const lockedUntil = new Date(Date.now() + lockMs);
  await this.updateOne(
    { _id: id },
    { $set: { 'mfa.lockedUntil': lockedUntil, 'mfa.failedAttempts': 0 } },
    opts(client),
  );
  return lockedUntil;
};

userSchema.statics.clearMfaFailures = async function clearMfaFailures(id, client) {
  await this.updateOne(
    { _id: id, $or: [{ 'mfa.failedAttempts': { $gt: 0 } }, { 'mfa.lockedUntil': { $ne: null } }] },
    { $set: { 'mfa.failedAttempts': 0, 'mfa.lockedUntil': null } },
    opts(client),
  );
};

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

userSchema.statics.updateProfile = async function updateProfile(userId, changes, client) {
  const $set = {};
  for (const [key, path] of Object.entries(PROFILE_FIELDS)) {
    if (Object.prototype.hasOwnProperty.call(changes, key)) $set[path] = changes[key];
  }

  // Record the local calendar day when age is updated
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

// Close the current goal and append a new one, carrying numeric targets forward
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

  // Replace the array in a single write guarded by $size to prevent concurrent overwrites
  const closed = goals.map((g) => (g === current ? { ...g, effectiveUntil: effectiveFrom } : g));
  await this.updateOne(
    { _id: input.userId, goals: { $size: goals.length } },
    { $set: { goals: [...closed, next] } },
    { runValidators: true, ...opts(client) },
  );
  return next;
};

// Update numeric targets on the active goal in place, creating an initial goal if none exists
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

userSchema.statics.setGoalTarget = async function setGoalTarget(userId, field, value, client) {
  return this.setGoalTargets(userId, { [field]: value }, client);
};

userSchema.statics.isSetupPending = function isSetupPending(profile, goal) {
  const prefs = profile?.workoutPrefs;
  const hasPrefs = Boolean(prefs?.categoryIds?.length || prefs?.equipment || prefs?.equipmentIds?.length
    || prefs?.muscleIds?.length || prefs?.secondaryMuscleIds?.length);
  const hasTargets = GOAL_TARGETS.some((key) => goal?.[key] != null);
  return !hasPrefs && !hasTargets && profile?.targetWeightKg == null && !profile?.coachTone;
};

userSchema.statics.listGoals = async function listGoals(userId, client) {
  const doc = await this.findById(userId, 'goals', opts(client)).lean();
  if (!doc || !Array.isArray(doc.goals)) return [];
  return [...doc.goals].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
};

// ===========================================================================
// Admin surface
// ===========================================================================

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
    this.find(f, PRIVATE_FIELDS, opts(client))
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    this.countDocuments(f, opts(client)),
  ]);

  let [docs, total] = await run(filter);

  // Fall back to exact UUID match when name/email search returns no results
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

userSchema.statics.countByRole = async function countByRole(client) {
  const rows = await this.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }])
    .session(opts(client).session || null);

  return rows.reduce((acc, row) => {
    acc[row._id || 'user'] = row.count;
    return acc;
  }, {});
};

// Update role and sync MFA state (admins require MFA; demoting to user resets authenticator MFA)
userSchema.statics.updateRole = async function updateRole(id, role, client) {
  const mfa = role === 'user'
    ? { mfa: { enabled: false, recoveryHashes: [], lastUsedStep: 0, failedAttempts: 0 } }
    : { 'mfa.enabled': true };
  return withId(
    await this.findByIdAndUpdate(
      id,
      { $set: { role, ...mfa } },
      { new: true, runValidators: true, fields: PRIVATE_FIELDS, ...opts(client) },
    ).lean(),
  );
};

// Pass null `reason` to reinstate a suspended account
userSchema.statics.setSuspension = async function setSuspension(id, reason, by, userMessage, client) {
  const update = reason
    ? { suspendedAt: new Date(), suspendedReason: reason, suspendedBy: by, suspendedUserMessage: userMessage || null }
    : { suspendedAt: null, suspendedReason: null, suspendedBy: null, suspendedUserMessage: null };
  return withId(
    await this.findByIdAndUpdate(id, { $set: update }, { new: true, fields: PRIVATE_FIELDS, ...opts(client) }).lean(),
  );
};

// Suspend account and schedule purge at `purgeAt`, or pass null to cancel both
userSchema.statics.setDeletion = async function setDeletion(id, purgeAt, { reason, by, userMessage } = {}, client) {
  const update = purgeAt
    ? { suspendedAt: new Date(), suspendedReason: reason, suspendedBy: by, suspendedUserMessage: userMessage || null, deletionScheduledFor: purgeAt }
    : { suspendedAt: null, suspendedReason: null, suspendedBy: null, suspendedUserMessage: null, deletionScheduledFor: null };
  return withId(
    await this.findByIdAndUpdate(id, { $set: update }, { new: true, fields: PRIVATE_FIELDS, ...opts(client) }).lean(),
  );
};

userSchema.statics.listDueForDeletion = async function listDueForDeletion(client) {
  const docs = await this.find({ deletionScheduledFor: { $lte: new Date() } }, 'role email fullName', opts(client)).lean();
  return docs.map(withId);
};

userSchema.statics.requirePasswordReset = async function requirePasswordReset(id, { reason, by } = {}, client) {
  return withId(
    await this.findByIdAndUpdate(
      id,
      { $set: { passwordResetRequiredAt: new Date(), passwordResetRequiredReason: reason, passwordResetRequiredBy: by } },
      { new: true, fields: PRIVATE_FIELDS, ...opts(client) },
    ).lean(),
  );
};

userSchema.statics.cancelPasswordReset = async function cancelPasswordReset(id, client) {
  return withId(
    await this.findByIdAndUpdate(
      id,
      { $set: { passwordResetRequiredAt: null, passwordResetRequiredReason: null, passwordResetRequiredBy: null } },
      { new: true, fields: PRIVATE_FIELDS, ...opts(client) },
    ).lean(),
  );
};

module.exports = mongoose.model('User', userSchema);