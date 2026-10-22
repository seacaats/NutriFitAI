const crypto = require('crypto');
const AuditLog = require('../../models/audit-logs/AuditLog');
const User = require('../../models/user/User');
const { capturesNetwork, HEALTH_FIELDS } = require('./actions');
const env = require('../../../config/env');

const { displayName, isVerified } = User;

/**
 * Resolves the actor/target display name and verification state to snapshot onto an audit entry.
 * Never throws; returns null labels on lookup failure so the audit entry is still written.
 */
async function resolveActor(explicitLabel, explicitRole, id, req) {
  const cached = req && req.user && req.user.id === id ? req.user : null;

  if (explicitLabel !== undefined && explicitLabel !== null) {
    return { label: explicitLabel, role: explicitRole ?? null, verified: isVerified(cached) };
  }
  if (!id) return { label: null, role: explicitRole ?? null, verified: null };

  if (cached) {
    return { label: displayName(cached), role: explicitRole ?? cached.role ?? null, verified: isVerified(cached) };
  }

  try {
    const user = await User.getById(id);
    return { label: displayName(user), role: explicitRole ?? user?.role ?? null, verified: isVerified(user) };
  } catch {
    return { label: null, role: explicitRole ?? null, verified: null };
  }
}

/**
 * Records an audit log entry from an Express request context without throwing on failure.
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
async function logAction(req, entry, overrides = {}) {
  try {
    const actorId = overrides.userId ?? req.userId ?? null;
    const targetId = entry.targetId ?? actorId;

    const actorRole = overrides.role ?? req.userRole ?? null;
    const actor = await resolveActor(entry.actorLabel, actorRole, actorId, req);

    const selfDirected = targetId === actorId;
    const target = selfDirected
      ? { label: actor.label, role: null }
      : await resolveActor(entry.targetLabel, entry.targetRole, targetId, req);

    const network = capturesNetwork(entry.action);
    const details = withHashes(entry);

    await AuditLog.record({
      userId: actorId,
      role: actor.role,
      actorVerified: actor.verified,
      actorLabel: actor.label,
      targetLabel: target.label,
      targetRole: target.role,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId,
      details,
      ipAddress: network ? req.ip ?? null : null,
      userAgent: network && req.get ? req.get('user-agent') || null : null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auditLogger] failed to record audit entry', entry.action, err);
  }
}

/**
 * Records an audit log entry for background jobs or scripts without an Express request.
 */
async function logSystemAction(entry) {
  try {
    const network = capturesNetwork(entry.action);
    const details = withHashes(entry);
    await AuditLog.record({
      userId: entry.userId ?? null,
      role: entry.role ?? null,
      actorVerified: entry.actorVerified ?? null,
      actorLabel: entry.actorLabel ?? null,
      targetLabel: entry.targetLabel ?? null,
      targetRole: entry.targetRole ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? entry.userId ?? null,
      details,
      ipAddress: network ? entry.ipAddress ?? null : null,
      userAgent: network ? entry.userAgent ?? null : null,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auditLogger] failed to record system audit entry', entry.action, err);
  }
}

/**
 * Builds the `details.changes` array from a before/after pair for the specified editable fields.
 * Redacts values for sensitive health fields in HEALTH_FIELDS.
 */
function diffFields(fields, before = {}, after = {}) {
  const changes = [];
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(after, field)) continue;
    const from = before[field] ?? null;
    const to = after[field] ?? null;
    if (String(from) === String(to)) continue;
    if (HEALTH_FIELDS.includes(field)) changes.push({ field });
    else changes.push({ field, from, to });
  }
  return changes;
}

// HMAC-SHA256 truncated to 16 hex chars for correlating identifiers without storing raw values
function hashIdentifier(value) {
  if (value === undefined || value === null || value === '') return null;
  return crypto
    .createHmac('sha256', env.audit.hashSecret)
    .update(String(value).trim())
    .digest('hex')
    .slice(0, 16);
}

function withHashes(entry) {
  if (!entry.hash) return entry.details ?? null;
  const hashed = Object.fromEntries(Object.entries(entry.hash).map(([key, raw]) => [key, hashIdentifier(raw)]));
  return { ...(entry.details || {}), ...hashed };
}

module.exports = { logAction, logSystemAction, diffFields };
