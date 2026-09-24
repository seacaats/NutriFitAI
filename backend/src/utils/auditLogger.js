const AuditLog = require('../models/AuditLog');
const User = require('../models/user/User');

/**
 * Convenience wrapper around AuditLog.record for code running inside an
 * Express request: pulls the actor (userId/role) and network details
 * (ip/user-agent) off `req` so call sites don't repeat that boilerplate.
 *
 * Failures are swallowed (logged, never thrown): an audit write must not be
 * able to fail the user-facing action it is describing. A profile update
 * that succeeds but whose audit entry fails to write should still return 200
 * -- the alternative (a 500 caused by logging) is strictly worse than a gap
 * in the trail.
 *
 * `req.userId` / `req.userRole` are populated by requireAuth /
 * attachUserIfPresent (see middleware/authMiddleware.js). Both are omitted
 * (recorded as null) for requests with no authenticated actor yet, such as
 * registration itself -- pass an explicit `userId`/`role` in `overrides` for
 * that case, since the account did not exist when the request began.
 *
 * @param {import('express').Request} req
 * @param {{
 *   action: string,
 *   targetType?: string|null,
 *   targetId?: string|null,
 *   details?: object|null,
 *   actorLabel?: string|null,
 *   targetLabel?: string|null,
 *   targetRole?: string|null,
 * }} entry
 * @param {{ userId?: string|null, role?: string|null }} [overrides]
 */

/**
 * Resolves the display name to SNAPSHOT onto the entry.
 *
 * Two shortcuts before it costs a query, in order:
 *   1. the caller passed a label explicitly (it already had the document);
 *   2. the id belongs to req.user, which requireFreshRole/requireVerifiedEmail
 *      have already loaded on every admin route.
 * Only a genuinely unknown id -- an admin acting on a user they did not fetch
 * -- reaches the database, and that is an indexed primary-key lookup.
 *
 * Returns null rather than throwing on any failure. A missing label degrades
 * the rendered sentence to "A deleted account" (see auditActions.buildContext),
 * which is a worse audit line but still an audit line; losing the whole entry
 * because a name lookup failed would be the wrong trade.
 */
function displayName(user) {
  if (!user) return null;
  return user.fullName || user.email || null;
}

async function resolveActor(explicitLabel, explicitRole, id, req) {
  if (explicitLabel !== undefined && explicitLabel !== null) {
    return { label: explicitLabel, role: explicitRole ?? null };
  }
  if (!id) return { label: null, role: explicitRole ?? null };

  if (req && req.user && req.user.id === id) {
    return { label: displayName(req.user), role: explicitRole ?? req.user.role ?? null };
  }

  try {
    const user = await User.findById(id);
    return { label: displayName(user), role: explicitRole ?? user?.role ?? null };
  } catch {
    return { label: null, role: explicitRole ?? null };
  }
}

async function logAction(req, entry, overrides = {}) {
  try {
    const actorId = overrides.userId ?? req.userId ?? null;
    // Defaults to the actor themselves -- most actions are self-directed
    // (a user editing their own profile), so callers only need to pass
    // targetId explicitly when acting on someone else (e.g. an admin
    // editing another user's account).
    const targetId = entry.targetId ?? actorId;

    const actorRole = overrides.role ?? req.userRole ?? null;
    const actor = await resolveActor(entry.actorLabel, actorRole, actorId, req);

    // A self-directed action needs only one lookup, not two -- and its target
    // role is left null, since the actor's own role already says it.
    const selfDirected = targetId === actorId;
    const target = selfDirected
      ? { label: actor.label, role: null }
      : await resolveActor(entry.targetLabel, entry.targetRole, targetId, req);

    await AuditLog.record({
      userId: actorId,
      role: actor.role,
      actorLabel: actor.label,
      targetLabel: target.label,
      targetRole: target.role,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId,
      details: entry.details ?? null,
      ipAddress: req.ip ?? null,
      userAgent: req.get ? req.get('user-agent') || null : null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auditLogger] failed to record audit entry', entry.action, err);
  }
}

/**
 * Same contract as logAction, for code with no `req` to read from (a cron
 * job, a script, a queue worker). Every field the caller wants recorded must
 * be passed explicitly since there is no request to derive it from.
 *
 * Labels are NOT looked up here. A background job usually has no user at all
 * (the retention purge, the wger catalog sync), and the ones that do already
 * hold the document -- so a lookup would mostly be a wasted query against the
 * ops/sec budget on behalf of a caller that could have passed the name.
 */
async function logSystemAction(entry) {
  try {
    await AuditLog.record({
      userId: entry.userId ?? null,
      role: entry.role ?? null,
      actorLabel: entry.actorLabel ?? null,
      targetLabel: entry.targetLabel ?? null,
      targetRole: entry.targetRole ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? entry.userId ?? null,
      details: entry.details ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auditLogger] failed to record system audit entry', entry.action, err);
  }
}

/**
 * Builds the `details.changes` array from a before/after pair, dropping
 * fields that did not actually move.
 *
 * Exists so that no call site hand-rolls the shape auditActions.js renders.
 * `fields` is passed explicitly rather than diffing every key, because the
 * caller knows which fields were EDITABLE in that request -- diffing whole
 * documents would record incidental churn (an updatedAt bump) as a user
 * change.
 *
 *   diffFields(['email', 'fullName'], before, after)
 *     -> [{ field: 'email', from: 'a@x.com', to: 'b@x.com' }]
 *
 * Returns an empty array when nothing changed, which is the caller's cue to
 * skip the audit entry entirely: a "profile updated" row recording no change
 * is noise, and the profile controller already skips no-op writes.
 */
function diffFields(fields, before = {}, after = {}) {
  const changes = [];
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(after, field)) continue;
    const from = before[field] ?? null;
    const to = after[field] ?? null;
    // Loose-ish comparison via String() so 70 and "70" from a form post are
    // not recorded as a change. Nulls are normalised above first, so
    // String(null) collides only with the literal string "null", which no
    // audited field carries.
    if (String(from) === String(to)) continue;
    changes.push({ field, from, to });
  }
  return changes;
}

module.exports = { logAction, logSystemAction, diffFields };
