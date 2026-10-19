const env = require('../../../config/env');
const PushToken = require('../../models/notifications/PushToken');
const User = require('../../models/user/User');
const { logSystemAction } = require('../../utils/audit-logs/auditLogger');

// Expo Push API: one POST per batch of up to 100 messages, one ticket back
// per message. A ticket error for one device doesn't fail the others
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const BATCH_SIZE = 100;
const RECEIPT_BATCH_SIZE = 1000;

// Receipts are ready about 15 minutes after the send and kept by Expo for a
// day. Pending tickets live in memory: a restart loses them, which only
// means those few dead tokens wait for the next failed send or the 60-day
// cleanup instead
const RECEIPT_DELAY_MS = 15 * 60 * 1000;
const RECEIPT_MAX_AGE_MS = 23 * 60 * 60 * 1000;
const pendingReceipts = new Map(); // ticketId -> { token, userId, kind, sentAt }

function headers() {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' };
  // Only needed when "enhanced push security" is turned on in the Expo project
  if (env.push.expoAccessToken) h.Authorization = `Bearer ${env.push.expoAccessToken}`;
  return h;
}

// logSystemAction doesn't look names up, so a failed push names its user here.
// Without it the audit line reads "an unidentified user"
async function auditPush({ action, token, userId, details }) {
  let target = {};
  try {
    const user = await User.getById(userId);
    target = { targetLabel: User.displayName(user), targetRole: user?.role ?? null };
  } catch {
    // Unnamed entry beats no entry
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

// One POST of up to 100 messages. On failure the error carries Expo's own
// reason next to the status, so the audit row says why (a bare 403 doesn't)
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

// One failed device: a dead token is dropped, anything else is audited.
// Shared by the immediate ticket and the later receipt
async function handleError({ token, userId, kind, details, message }) {
  if (details?.error === 'DeviceNotRegistered') {
    await PushToken.removeToken(token).catch(() => {});
    await auditPush({ action: 'notification.push_token.invalidated', token, userId });
    return;
  }
  await auditFailure({ token, userId, kind, reason: details?.error || message || 'Unknown' });
}

/**
 * Sends one notification to every device of one user. Never throws: a
 * failed push is audited, and the inbox row (written by notify) still exists.
 *
 * The ticket is Expo's immediate answer. An ok ticket is kept for
 * checkReceipts, Apple/Google's later word on whether it was delivered
 *
 * @param {{ userId: string, kind: string, title: string, body: string, link?: string|null }} message
 */
async function sendPush({ userId, kind, title, body, link = null }) {
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
      data: link ? { link } : {},
    }));

    let tickets;
    try {
      tickets = await postMessages(messages);
    } catch (err) {
      if (err.status >= 400 && err.status < 500 && messages.length > 1) {
        // Expo refused the batch (one device can be enough). Send them one by
        // one so the good devices still get it; a failed one is audited below
        tickets = [];
        for (const m of messages) {
          try {
            tickets.push(...(await postMessages([m])));
          } catch (one) {
            tickets.push({ status: 'error', message: one.message });
          }
        }
      } else {
        // The whole batch failed (network, Expo down): one row per device
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

// Run by the scheduler. Asks Expo about tickets at least RECEIPT_DELAY_MS
// old; ones past RECEIPT_MAX_AGE_MS are dropped unasked (Expo no longer has them)
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
    // Left pending on failure, so the next run tries again
    if (!res.ok || !json.data) throw new Error(`Expo receipts HTTP ${res.status}`);

    for (const id of ids) {
      const receipt = json.data[id];
      // Not ready yet: ask again next run
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