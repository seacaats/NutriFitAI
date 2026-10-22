const Notification = require('../models/notifications/Notification');
const PushToken = require('../models/notifications/PushToken');
const { sendSuccess, asyncHandler } = require('../utils/httpResponse');
const { logAction } = require('../utils/audit-logs/auditLogger');

// POST /api/notifications/tokens -- register device push token (audit only newly assigned tokens)
const registerToken = asyncHandler(async (req, res) => {
  const { token, platform } = req.body;
  const isNew = await PushToken.register({ userId: req.userId, token, platform });
  if (isNew) {
    await logAction(req, {
      action: 'account.push_token.registered',
      targetType: 'user',
      details: { platform },
      hash: { tokenHash: token },
    });
  }
  return sendSuccess(res, { message: 'Device registered' });
});

// DELETE /api/notifications/tokens
const revokeToken = asyncHandler(async (req, res) => {
  const removed = await PushToken.revoke(req.userId, req.body.token);
  if (removed) {
    await logAction(req, {
      action: 'account.push_token.revoked',
      targetType: 'user',
      hash: { tokenHash: req.body.token },
    });
  }
  return sendSuccess(res, { message: 'Device unregistered' });
});

// GET /api/notifications
const listNotifications = asyncHandler(async (req, res) => {
  const limit = req.validatedQuery?.limit || 30;
  const { rows, unread } = await Notification.inbox(req.userId, { before: req.validatedQuery?.before, limit });
  return sendSuccess(res, {
    data: {
      rows,
      unread,
      nextBefore: rows.length === limit ? rows.at(-1).createdAt : null,
    },
  });
});

// POST /api/notifications/read
const markRead = asyncHandler(async (req, res) => {
  const updated = await Notification.markRead(req.userId, req.body.ids || []);
  return sendSuccess(res, { data: { updated } });
});

module.exports = { registerToken, revokeToken, listNotifications, markRead };
