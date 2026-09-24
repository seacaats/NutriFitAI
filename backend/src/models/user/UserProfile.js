const db = require('../../../config/mongo');
const { User: UserDoc } = require('../schemas');
const { today } = require('../../utils/calendarDay');

const { opts } = db;

/**
 * The profile is an embedded subdocument on the user, not its own collection.
 *
 * Every method here therefore writes dotted paths into `profile.*` on the user
 * document. The interface is unchanged from the Postgres version so controllers
 * do not care, but two things follow from the embedding:
 *
 *   - There is no such thing as a user without a profile row. `upsert`'s
 *     create-if-missing branch is gone because the case cannot arise: the
 *     schema gives `profile` a default of {}.
 *   - A profile read costs nothing extra, since the caller almost always has
 *     the user document already.
 */

/**
 * Keys callers may write, mapped from camelCase input to the stored path.
 *
 * A whitelist, not a convenience. It is what stops a caller passing
 * `{ role: 'admin' }` or `{ passwordHash: ... }` through a generic updater and
 * having it applied. The step-tracking fields sit in the same map only because
 * updateProfileSchema is .strict() -- PATCH /api/profile rejects those keys
 * outright, so only stepsController can reach them.
 */
const UPDATABLE = {
  age: 'profile.age',
  gender: 'profile.gender',
  heightCm: 'profile.heightCm',
  activityLevel: 'profile.activityLevel',
  dietPreference: 'profile.dietPreference',
  healthConditions: 'profile.healthConditions',
  timezone: 'profile.timezone',
  avatarStorageKey: 'profile.avatarStorageKey',
  theme: 'profile.theme',
  notificationsEnabled: 'profile.notificationsEnabled',

  stepSource: 'profile.stepSource',
  stepPermissionAt: 'profile.stepPermissionAt',
  lastStepSyncAt: 'profile.lastStepSyncAt',
};

const UserProfile = {
  async findByUserId(userId, client = db) {
    const doc = await UserDoc.findById(userId, 'profile', opts(client)).lean();
    return doc ? doc.profile || {} : null;
  },

  /**
   * Partial update. Only keys present in `changes` are written, so a caller
   * sending just { age } cannot blank out gender or height by omission.
   * Explicitly passing null DOES clear a field -- that is how "Health
   * Conditions: none" is stored, and why `hasOwnProperty` is the test rather
   * than a truthiness check.
   *
   * Returns null when there is nothing to write, so callers can distinguish
   * "no change requested" from "user missing".
   */
  async update(userId, changes, client = db) {
    const $set = {};

    for (const [key, path] of Object.entries(UPDATABLE)) {
      if (!Object.prototype.hasOwnProperty.call(changes, key)) continue;
      $set[path] = changes[key];
    }

    /**
     * ageRecordedOn exists so a stored age can be aged forward later, which is
     * only meaningful if it moves whenever age itself is written.
     *
     * It is a CALENDAR DAY, so it is a string from the calendarDay helper and
     * never `new Date()`. Resolved in the user's own timezone when we know it:
     * for a user in UTC+8, a UTC-derived date would record yesterday for
     * anything saved before 08:00 local.
     */
    if (Object.prototype.hasOwnProperty.call(changes, 'age')) {
      if (changes.age === null) {
        $set['profile.ageRecordedOn'] = null;
      } else {
        const tz = changes.timezone
          ?? (await UserProfile.findByUserId(userId, client))?.timezone;
        $set['profile.ageRecordedOn'] = today(tz);
      }
    }

    if (Object.keys($set).length === 0) return null;

    const doc = await UserDoc.findByIdAndUpdate(
      userId,
      { $set },
      { new: true, runValidators: true, projection: 'profile', ...opts(client) },
    ).lean();

    return doc ? doc.profile : null;
  },

  /**
   * Kept for interface compatibility with the Postgres version, where it
   * existed to create a missing profile row before updating it -- Google-linked
   * accounts predated the row being guaranteed, and a hand-deleted row would
   * otherwise update zero rows silently.
   *
   * That failure mode is now impossible: `profile` is a subdocument of the user
   * with a default of {}, so if the user exists the profile exists. This is a
   * straight delegation, retained so callers need no edit.
   */
  async upsert(userId, changes, client = db) {
    const updated = await UserProfile.update(userId, changes, client);
    return updated || UserProfile.findByUserId(userId, client);
  },

  /**
   * Alias for upsert, kept because authController calls UserProfile.create
   * during registration.
   *
   * Under Postgres this was a genuine INSERT into user_profiles. The profile is
   * now a subdocument with a default of {}, so it already exists the moment the
   * user does -- there is nothing to create, only fields to fill. Aliasing
   * rather than renaming the call site keeps registration working and leaves
   * the name meaningful from the caller's point of view.
   */
  async create(input, client = db) {
    const { userId, ...changes } = input;
    return UserProfile.upsert(userId, changes, client);
  },

  /**
   * Sets the avatar only if none is stored.
   *
   * The filter does the work rather than a coalesce: a user who has uploaded
   * their own picture must not have it replaced by the one from a later Google
   * sign-in.
   */
  async updateAvatarIfEmpty(userId, avatarStorageKey, client = db) {
    const doc = await UserDoc.findOneAndUpdate(
      {
        _id: userId,
        $or: [
          { 'profile.avatarStorageKey': null },
          { 'profile.avatarStorageKey': { $exists: false } },
        ],
      },
      { $set: { 'profile.avatarStorageKey': avatarStorageKey } },
      { new: true, projection: 'profile', ...opts(client) },
    ).lean();

    // No match means an avatar was already set, which is success, not failure.
    return doc ? doc.profile : UserProfile.findByUserId(userId, client);
  },

  async updateAvatar(userId, avatarStorageKey, client = db) {
    const doc = await UserDoc.findByIdAndUpdate(
      userId,
      { $set: { 'profile.avatarStorageKey': avatarStorageKey } },
      { new: true, projection: 'profile', ...opts(client) },
    ).lean();
    return doc ? doc.profile : null;
  },
};

module.exports = UserProfile;