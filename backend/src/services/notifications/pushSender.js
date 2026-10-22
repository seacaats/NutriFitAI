const env = require('../../../config/env');
const PushToken = require('../../models/notifications/PushToken');
const User = require('../../models/user/User');
const { logSystemAction } = require('../../utils/audit-logs/auditLogger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const BATCH_SIZE = 100;
const RECEIPT_BATCH_SIZE = 1000;

const RECEIPT_DELAY_MS = 15 * 60 * 1000;
const RECEIPT_MAX_AGE_MS = 23 * 60 * 60 * 1000;
const pendingReceipts = new Map(); // ticketId -> { token, userId, kind, sentAt }

function headers() {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' };
  if (env.push.expoAccessToken) h.Authorization = `Bearer ${env.push.expoAccessToken}`;
  return h;
}

async function auditPush({ action, token, userId, details }) {
  let target = {};
  try {
    const user = await User.getById(userId);
    target = { targetLabel: User.displayName(user), targetRole: user?.role ?? null };
  } catch {
    // Ignore user lookup errors so the audit entry is still recorded
  }
  await logSystemAction({
    action,
    targetType: 'user',
    targetId: userId,
    ...target,
    details,
    hash: { tokenHash: token },
  });
}

const auditFailure = ({ token, userId, kind, reason }) => auditPush({
  action: 'notification.delivery.failed', token, userId, details: { kind, reason },
});

async function postMessages(messages) {
  const res = await fetch(EXPO_PUSH_URL, { method: 'POST', headers: headers(), body: JSON.stringify(messages) });
  const json = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(json?.data)) {
    const why = json?.errors?.[0];
    const detail = why ? `: ${[why.code, why.message].filter(Boolean).join(' ')}`.slice(0, 200) : '';
    throw Object.assign(new Error(`Expo push HTTP ${res.status}${detail}`), { status: res.status });
  }
  return json.data;
}

async function handleError({ token, userId, kind, details, message }) {
  if (details?.error === 'DeviceNotRegistered') {
    await PushToken.removeToken(token).catch(() => {});
    await auditPush({ action: 'notification.push_token.invalidated', token, userId });
    return;
  }
  await auditFailure({ token, userId, kind, reason: details?.error || message || 'Unknown' });
}

/**
 * Sends a push notification to all registered devices of a user and queues tickets for receipt checks.
 *
 * @param {{ userId: string, kind: string, title: string, body: string, link?: string|null, id?: string|null }} message
 */
async function sendPush({ userId, kind, title, body, link = null, id = null }) {
  let tokens;
  try {
    tokens = await PushToken.listFor(userId);
  } catch (err) {
    console.error('[push] could not load tokens', err);
    return;
  }
  if (tokens.length === 0) return;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const messages = batch.map((t) => ({
      to: t.token,
      title,
      body,
      sound: 'default',
      data: { ...(link && { link }), ...(id && { id: String(id) }) },
    }));

    let tickets;
    try {
      tickets = await postMessages(messages);
    } catch (err) {
      if (err.status >= 400 && err.status < 500 && messages.length > 1) {
        // Retry individually when a batch is rejected due to a single bad message
        tickets = [];
        for (const m of messages) {
          try {
            tickets.push(...(await postMessages([m])));
          } catch (one) {
            tickets.push({ status: 'error', message: one.message });
          }
        }
      } else {
        for (const t of batch) await auditFailure({ token: t.token, userId, kind, reason: err.message });
        continue;
      }
    }

    for (let j = 0; j < tickets.length; j += 1) {
      const ticket = tickets.at(j);
      const token = batch.at(j)?.token;
      if (!token) continue;
      if (ticket.status === 'ok' && ticket.id) {
        pendingReceipts.set(ticket.id, { token, userId, kind, sentAt: Date.now() });
      } else if (ticket.status === 'error') {
        await handleError({ token, userId, kind, details: ticket.details, message: ticket.message });
      }
    }
  }
}

// Polls Expo for delivery receipts of tickets older than RECEIPT_DELAY_MS
async function checkReceipts(now = Date.now()) {
  const ready = [];
  for (const [id, entry] of pendingReceipts) {
    const age = now - entry.sentAt;
    if (age >= RECEIPT_MAX_AGE_MS) pendingReceipts.delete(id);
    else if (age >= RECEIPT_DELAY_MS) ready.push(id);
  }

  for (let i = 0; i < ready.length; i += RECEIPT_BATCH_SIZE) {
    const ids = ready.slice(i, i + RECEIPT_BATCH_SIZE);
    const res = await fetch(EXPO_RECEIPTS_URL, { method: 'POST', headers: headers(), body: JSON.stringify({ ids }) });
    const json = await res.json();
    if (!res.ok || !json.data) throw new Error(`Expo receipts HTTP ${res.status}`);

    for (const id of ids) {
      const receipt = json.data[id];
      if (!receipt) continue;
      const entry = pendingReceipts.get(id);
      pendingReceipts.delete(id);
      if (receipt.status === 'error' && entry) {
        await handleError({ ...entry, details: receipt.details, message: receipt.message });
      }
    }
  }
}

module.exports = { sendPush, checkReceipts };
