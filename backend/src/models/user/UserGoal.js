const db = require('../../../config/mongo');
const { User: UserDoc } = require('../schemas');
const { today, assertCalendarDay } = require('../../utils/calendarDay');

const { opts } = db;

/**
 * Goals are an append-only history embedded on the user.
 *
 * user_goals was never a single mutable row: it carries effectiveFrom /
 * effectiveUntil precisely so that "what was this user working toward in June?"
 * stays answerable for the progress screens. A goal change closes the current
 * entry and opens a new one rather than overwriting.
 *
 * Embedded because the array is bounded in practice -- a handful of changes a
 * year, realistically under fifty entries, nowhere near the 16 MB document
 * ceiling -- and because it is read on every dashboard render alongside the
 * user. Under Postgres, finding the active goal needed a partial index; here it
 * is a scan of a short array the caller already has in memory.
 *
 * !! The one thing that would break this: a feature that writes goal entries
 * PROGRAMMATICALLY -- weekly auto-adjustment of calorie targets, say. The array
 * becomes unbounded the moment entries stop coming from a human tapping save,
 * and at that point this must be promoted to its own collection.
 */

/** The active goal is the one with no end date. */
function activeOf(goals) {
  if (!Array.isArray(goals)) return null;
  return goals.find((g) => g.effectiveUntil === null || g.effectiveUntil === undefined) || null;
}

const UserGoal = {
  /**
   * Seeds the first goal at registration.
   *
   * Usually unnecessary as a separate call: User.create accepts `initialGoal`
   * and writes it in the same insert. Kept for callers that add a goal to an
   * account created without one, such as an OAuth signup.
   *
   * @param {{ userId: string, fitnessGoal: string|null, effectiveFrom?: string }} input
   */
  async createInitial(input, client = db) {
    const effectiveFrom = input.effectiveFrom
      ? assertCalendarDay(input.effectiveFrom, 'effectiveFrom')
      : today((await UserDoc.findById(input.userId, 'profile.timezone', opts(client)).lean())
          ?.profile?.timezone);

    const entry = {
      fitnessGoal: input.fitnessGoal,
      dailyCaloriesKcal: null,
      dailyProteinG: null,
      dailyCarbsG: null,
      dailyFatG: null,
      dailyWaterMl: null,
      dailySteps: null,
      weeklyWorkouts: null,
      effectiveFrom,
      effectiveUntil: null,
    };

    await UserDoc.updateOne(
      { _id: input.userId },
      { $push: { goals: entry } },
      { runValidators: true, ...opts(client) },
    );
    return entry;
  },

  async findActiveByUserId(userId, client = db) {
    const doc = await UserDoc.findById(userId, 'goals', opts(client)).lean();
    return doc ? activeOf(doc.goals) : null;
  },

  /**
   * Changes the active goal: closes the current entry, opens a new one.
   *
   * Call inside a transaction. The close and the append must not be separable,
   * or a crash between them leaves the user with no active goal -- and every
   * screen that reads a target would silently fall back to defaults.
   *
   * ---------------------------------------------------------------------------
   * effectiveFrom is the one place a database default disappeared
   * ---------------------------------------------------------------------------
   * Postgres declared `effective_from date DEFAULT CURRENT_DATE`, so the server
   * supplied the calendar day. Nothing supplies it now.
   *
   * Resolved in the USER's timezone, not the server's. For a user in UTC+8 a
   * UTC-derived day is wrong for the first eight hours of every morning, which
   * would make a goal set at 7am appear to have started yesterday -- and would
   * overlap the entry it was meant to succeed.
   *
   * Callers may pass effectiveFrom explicitly; it is validated as a string
   * rather than coerced, so a Date arriving here fails loudly instead of being
   * formatted into something off by a day.
   *
   * @param {{ userId: string, fitnessGoal: string|null, effectiveFrom?: string }} input
   */
  async setActive(input, client = db) {
    const doc = await UserDoc.findById(input.userId, 'goals profile.timezone', opts(client)).lean();
    if (!doc) return null;

    const current = activeOf(doc.goals);

    // Nothing to do if the goal is unchanged -- avoids an entry per save on a
    // form where the user only edited their height.
    if (current && current.fitnessGoal === input.fitnessGoal) {
      return current;
    }

    const effectiveFrom = input.effectiveFrom
      ? assertCalendarDay(input.effectiveFrom, 'effectiveFrom')
      : today(doc.profile?.timezone);

    // Carries the numeric targets forward; only the goal itself changes here.
    // A user who set a 1900 kcal target and then switches from "lose weight" to
    // "maintain" should not silently lose the number they chose.
    const next = {
      fitnessGoal: input.fitnessGoal,
      dailyCaloriesKcal: current?.dailyCaloriesKcal ?? null,
      dailyProteinG: current?.dailyProteinG ?? null,
      dailyCarbsG: current?.dailyCarbsG ?? null,
      dailyFatG: current?.dailyFatG ?? null,
      dailyWaterMl: current?.dailyWaterMl ?? null,
      dailySteps: current?.dailySteps ?? null,
      weeklyWorkouts: current?.weeklyWorkouts ?? null,
      effectiveFrom,
      effectiveUntil: null,
    };

    /**
     * Close and append in ONE update.
     *
     * The positional filter closes whichever entry is currently open while the
     * same operation pushes the replacement, so there is no instant at which
     * the user has zero active goals -- not even inside a transaction, and not
     * even if the process dies. Two separate updates would reintroduce exactly
     * the window the SQL version needed a transaction to cover.
     */
    const update = { $push: { goals: next } };
    if (current) {
      update.$set = { 'goals.$[open].effectiveUntil': effectiveFrom };
    }

    await UserDoc.updateOne({ _id: input.userId }, update, {
      arrayFilters: current
        ? [{ $or: [{ 'open.effectiveUntil': null }, { 'open.effectiveUntil': { $exists: false } }] }]
        : undefined,
      runValidators: true,
      ...opts(client),
    });

    return next;
  },

  /** Full history, newest first, for the progress screens. */
  async listByUserId(userId, client = db) {
    const doc = await UserDoc.findById(userId, 'goals', opts(client)).lean();
    if (!doc || !Array.isArray(doc.goals)) return [];
    return [...doc.goals].sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  },
};

module.exports = UserGoal;