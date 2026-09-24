const env = require('../../config/env');
const ChatConversation = require('../models/chat/ChatConversation');
const ChatMessage = require('../models/chat/ChatMessage');
const { coachReply, HISTORY_TURNS } = require('../services/ai/chatProvider');
const { health } = require('../services/ai/router');
const { sendSuccess, ApiError, asyncHandler } = require('../utils/httpResponse');

const SURFACE = 'coach';

// Recent-history dropdown only ever shows the last 10 threads. listByUser
// already sorts by updatedAt desc, so index 0 is always the most recently
// touched conversation — the "last one recorded" requirement falls out of
// that sort for free.
const HISTORY_LIMIT = 10;

function toClientMessage(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.createdAt,
    // See model chain
    ...(env.nodeEnv === 'development' && row.provider ? { provider: row.provider } : {}),
  };
}

// First line sent by user, used as conversation title
function deriveTitle(message) {
  const firstLine = message.split('\n')[0].trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
}

// POST /api/coach/chat
const sendMessage = asyncHandler(async (req, res) => {
  const { message, conversationId } = req.body;

  let conversation;
  if (conversationId) {
    conversation = await ChatConversation.findOwned({ id: conversationId, userId: req.userId });
    // 404 rather than 403 to avoid leaks of existing conversations
    if (!conversation) throw ApiError.notFound('Conversation not found');
  } else {
    conversation = await ChatConversation.create({ userId: req.userId, surface: SURFACE });
  }

  // Fetch conversation history before saving to avoid,
  // appended messages by the Coach to appear twice
  const history = await ChatMessage.listByConversation({
    conversationId: conversation.id,
    limit: HISTORY_TURNS,
  });

  let reply;
  try {
    reply = await coachReply({
      userId: req.userId,
      history,
      message,
      // Cancel currently ongoing AI requests if the user disconnects
      // to preserve quota and storage
      signal: AbortSignal.any
        ? AbortSignal.any([req.signal].filter(Boolean))
        : undefined,
    });
  } catch (err) {
    // User messages are persisted even when generation fails, but
    // failed assistant turns aren't stored
    await ChatMessage.create({
      conversationId: conversation.id,
      role: 'user',
      content: message,
    });
    await ChatConversation.touch(conversation.id);
    throw err;
  }

  await ChatMessage.create({
    conversationId: conversation.id,
    role: 'user',
    content: message,
  });
  const assistantRow = await ChatMessage.create({
    conversationId: conversation.id,
    role: 'assistant',
    content: reply.text,
    provider: reply.provider,
  });

  await ChatConversation.setTitleIfEmpty(conversation.id, deriveTitle(message));
  await ChatConversation.touch(conversation.id);

  return sendSuccess(res, {
    data: {
      conversationId: conversation.id,
      message: toClientMessage(assistantRow),
    },
  });
});

// GET /api/coach/conversations
const listConversations = asyncHandler(async (req, res) => {
  const rows = await ChatConversation.listByUser({
    userId: req.userId,
    surface: SURFACE,
    limit: HISTORY_LIMIT,
  });
  return sendSuccess(res, {
    data: rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })),
  });
});

// GET /api/coach/conversations/:id
const getConversation = asyncHandler(async (req, res) => {
  const conversation = await ChatConversation.findOwned({ id: req.params.id, userId: req.userId });
  if (!conversation) throw ApiError.notFound('Conversation not found');

  const messages = await ChatMessage.listByConversation({ conversationId: conversation.id });

  return sendSuccess(res, {
    data: {
      id: conversation.id,
      title: conversation.title,
      messages: messages.map(toClientMessage),
    },
  });
});

// DELETE /api/coach/conversations/:id
const deleteConversation = asyncHandler(async (req, res) => {
  const removed = await ChatConversation.remove({ id: req.params.id, userId: req.userId });
  if (!removed) throw ApiError.notFound('Conversation not found');
  return sendSuccess(res, { data: null, message: 'Conversation deleted' });
});

// GET /api/coach/health
//
// Names internal and rate-limited hosts
const getHealth = asyncHandler(async (req, res) => {
  if (env.nodeEnv === 'production') throw ApiError.notFound('Not found');
  return sendSuccess(res, { data: health() });
});

module.exports = {
  sendMessage,
  listConversations,
  getConversation,
  deleteConversation,
  getHealth,
};