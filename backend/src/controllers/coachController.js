const env = require('../../config/env');
const ChatConversation = require('../models/chat/ChatConversation');
const ChatMessage = require('../models/chat/ChatMessage');
const User = require('../models/user/User');
const { coachReply, toPlainText, HISTORY_TURNS } = require('../services/ai/chatProvider');
const { describeSubject } = require('../services/ai/contextBuilder');
const { health } = require('../services/ai/router');
const { sendSuccess, ApiError, asyncHandler } = require('../utils/httpResponse');
const { notify } = require('../services/notifications/notify');

const SURFACE = 'coach';

// A user keeps at most this many conversations. Starting another at the
// limit is refused, never silently dropping an old one. The client shows
// the same number in the history panel
const MAX_CONVERSATIONS = 10;

// A reply slower than this gets a push too, since the user has likely
// switched away. A disconnect cancels generation (see signal below), so
// slowness is the only sign left
const COACH_PUSH_AFTER_MS = 20 * 1000;

function toClientMessage(row) {
  return {
    id: row.id,
    role: row.role,
    // Replies saved before plain-text normalising existed get it on the way out
    content: row.role === 'assistant' ? toPlainText(row.content) : row.content,
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

// What a stored thread is about, in the shape describeSubject takes
function refOf(conversation) {
  if (conversation.scanRef?.scanId) return { scanId: conversation.scanRef.scanId };
  if (conversation.mealRef?.mealId) return { mealId: conversation.mealRef.mealId };
  return {};
}

async function userTimeZone(req) {
  if (req.timeZone) return req.timeZone;
  return (await User.getProfile(req.userId))?.timezone || undefined;
}

// POST /api/coach/chat -- scanId/mealId start a thread about that scan or meal
const sendMessage = asyncHandler(async (req, res) => {
  const { message, conversationId, scanId, mealId } = req.body;

  let conversation;
  if (conversationId) {
    conversation = await ChatConversation.findOwned({ id: conversationId, userId: req.userId });
    // 404 rather than 403 to avoid leaks of existing conversations
    if (!conversation) throw ApiError.notFound('Conversation not found');
  } else {
    const count = await ChatConversation.countByUser({ userId: req.userId, surface: SURFACE });
    if (count >= MAX_CONVERSATIONS) {
      throw ApiError.conflict(
        `You can keep up to ${MAX_CONVERSATIONS} conversations. Delete one to start a new one.`,
        { code: 'CONVERSATION_LIMIT' },
      );
    }
    // Owner-checked before the thread exists, so a foreign or deleted id
    // can't start a conversation pointing at it
    if (scanId || mealId) {
      const subject = await describeSubject(req.userId, { scanId, mealId });
      if (!subject || subject.missing) throw ApiError.notFound(scanId ? 'Scan not found' : 'Meal not found');
    }
    conversation = await ChatConversation.start({ userId: req.userId, surface: SURFACE, scanId, mealId });
  }

  // Fetch conversation history before saving to avoid,
  // appended messages by the Coach to appear twice
  const stored = await ChatMessage.listByConversation({
    conversationId: conversation.id,
    limit: HISTORY_TURNS,
  });

  // The last user message got no reply (it failed). This one overwrites it,
  // whether it's a retry or a rephrase, so failed turns never stack up and
  // the model never sees two user turns in a row
  const last = stored[stored.length - 1];
  const unanswered = last?.role === 'user' ? last : null;
  const history = unanswered ? stored.slice(0, -1) : stored;

  async function saveUserMessage() {
    if (unanswered) {
      await ChatMessage.overwrite(unanswered.id, message);
      return;
    }
    await ChatMessage.append({ conversationId: conversation.id, role: 'user', content: message });
  }

  const startedAt = Date.now();
  let reply;
  try {
    reply = await coachReply({
      userId: req.userId,
      ref: refOf(conversation),
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
    await saveUserMessage();
    await ChatConversation.setTitleIfEmpty(conversation.id, deriveTitle(message));
    await ChatConversation.touch(conversation.id);

    // Hand the conversation id back so the client keeps using this thread.
    // Replaces any provider details, which should never reach the client
    const failure = err instanceof ApiError
      ? err
      : ApiError.internal('The coach could not reply. Please try again.');
    failure.details = { conversationId: conversation.id };
    throw failure;
  }

  await saveUserMessage();
  const assistantRow = await ChatMessage.append({
    conversationId: conversation.id,
    role: 'assistant',
    content: reply.text,
    provider: reply.provider,
  });

  await ChatConversation.setTitleIfEmpty(conversation.id, deriveTitle(message));
  await ChatConversation.touch(conversation.id);

  // Not awaited: notify never throws, and the reply shouldn't wait on Expo
  if (Date.now() - startedAt >= COACH_PUSH_AFTER_MS) {
    notify(req.userId, 'coach_reply', { dedupeKey: `coach:${assistantRow.id}` });
  }

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
    limit: MAX_CONVERSATIONS,
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

  const [messages, subject] = await Promise.all([
    ChatMessage.listByConversation({ conversationId: conversation.id }),
    describeSubject(req.userId, refOf(conversation), await userTimeZone(req)),
  ]);

  return sendSuccess(res, {
    data: {
      id: conversation.id,
      title: conversation.title,
      // The scan or meal it's about, for the pinned chip. Null for general chats
      subject,
      messages: messages.map(toClientMessage),
    },
  });
});

// GET /api/coach/subject?scanId=|mealId= -- the chip shown when "Ask AI
// Coach" opens the chat, before anything is sent. Nothing is created here
const getSubject = asyncHandler(async (req, res) => {
  const { scanId, mealId } = req.validatedQuery;
  const subject = await describeSubject(req.userId, { scanId, mealId }, await userTimeZone(req));
  if (!subject || subject.missing) throw ApiError.notFound(scanId ? 'Scan not found' : 'Meal not found');
  return sendSuccess(res, { data: subject });
});

// DELETE /api/coach/conversations/:id
const deleteConversation = asyncHandler(async (req, res) => {
  const removed = await ChatConversation.removeOwned({ id: req.params.id, userId: req.userId });
  if (!removed) throw ApiError.notFound('Conversation not found');
  return sendSuccess(res, { data: null, message: 'Conversation deleted' });
});

// DELETE /api/coach/conversations -- all of this user's coach conversations
const deleteAllConversations = asyncHandler(async (req, res) => {
  const removed = await ChatConversation.removeAllOwned({ userId: req.userId, surface: SURFACE });
  return sendSuccess(res, { data: { removed }, message: 'Conversations deleted' });
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
  deleteAllConversations,
  listConversations,
  getConversation,
  deleteConversation,
  getSubject,
  getHealth,
};