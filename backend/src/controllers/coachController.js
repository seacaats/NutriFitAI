const env = require('../../config/env');
const ChatConversation = require('../models/chat/ChatConversation');
const ChatMessage = require('../models/chat/ChatMessage');
const { coachReply, toPlainText, HISTORY_TURNS } = require('../services/ai/chatProvider');
const { describeSubject } = require('../services/ai/contextBuilder');
const { transcribeAudio } = require('../services/ai/transcribe');
const { health } = require('../services/ai/router');
const { sendSuccess, ApiError, asyncHandler } = require('../utils/httpResponse');
const { notify } = require('../services/notifications/notify');
const { userTimeZone } = require('../services/user/userTimeZone');

const SURFACE = 'coach';

const MAX_CONVERSATIONS = 10;

// Send a push notification when a reply takes longer than this threshold
const COACH_PUSH_AFTER_MS = 20 * 1000;

function toClientMessage(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.role === 'assistant' ? toPlainText(row.content) : row.content,
    createdAt: row.createdAt,
    ...(env.nodeEnv === 'development' && row.provider ? { provider: row.provider } : {}),
  };
}

function deriveTitle(message) {
  const firstLine = message.split('\n')[0].trim();
  return firstLine.length > 60 ? `${firstLine.slice(0, 57)}...` : firstLine;
}

function refOf(conversation) {
  if (conversation.scanRef?.scanId) return { scanId: conversation.scanRef.scanId };
  if (conversation.mealRef?.mealId) return { mealId: conversation.mealRef.mealId };
  return {};
}

// POST /api/coach/chat
const sendMessage = asyncHandler(async (req, res) => {
  const { message, conversationId, scanId, mealId } = req.body;

  let conversation;
  if (conversationId) {
    conversation = await ChatConversation.findOwned({ id: conversationId, userId: req.userId });
    if (!conversation) throw ApiError.notFound('Conversation not found');
  } else {
    const count = await ChatConversation.countByUser({ userId: req.userId, surface: SURFACE });
    if (count >= MAX_CONVERSATIONS) {
      throw ApiError.conflict(
        `You can keep up to ${MAX_CONVERSATIONS} conversations. Delete one to start a new one.`,
        { code: 'CONVERSATION_LIMIT' },
      );
    }
    if (scanId || mealId) {
      const subject = await describeSubject(req.userId, { scanId, mealId });
      if (!subject || subject.missing) throw ApiError.notFound(scanId ? 'Scan not found' : 'Meal not found');
    }
    conversation = await ChatConversation.start({ userId: req.userId, surface: SURFACE, scanId, mealId });
  }

  const stored = await ChatMessage.listByConversation({
    conversationId: conversation.id,
    limit: HISTORY_TURNS,
  });

  // Overwrite a trailing unanswered user message on retry so failed turns do not stack
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
      signal: AbortSignal.any
        ? AbortSignal.any([req.signal].filter(Boolean))
        : undefined,
    });
  } catch (err) {
    await saveUserMessage();
    await ChatConversation.touch(conversation.id, deriveTitle(message));

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

  await ChatConversation.touch(conversation.id, deriveTitle(message));

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
      subject,
      messages: messages.map(toClientMessage),
    },
  });
});

// GET /api/coach/subject?scanId=|mealId=
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

// DELETE /api/coach/conversations
const deleteAllConversations = asyncHandler(async (req, res) => {
  const removed = await ChatConversation.removeAllOwned({ userId: req.userId, surface: SURFACE });
  return sendSuccess(res, { data: { removed }, message: 'Conversations deleted' });
});

// GET /api/coach/health (disabled in production)
const getHealth = asyncHandler(async (req, res) => {
  if (env.nodeEnv === 'production') throw ApiError.notFound('Not found');
  return sendSuccess(res, { data: health() });
});

// Supported Whisper language codes (kept in sync with frontend VOICE_LANGUAGES; 'auto' lets Whisper detect)
const VOICE_LANGUAGES = new Set([
  'af', 'sq', 'am', 'ar', 'hy', 'az', 'be', 'bn', 'bs', 'bg', 'my', 'zh', 'hr', 'cs', 'da', 'nl', 'en', 'et', 'fi', 'fr',
  'ka', 'de', 'el', 'ht', 'ha', 'he', 'hi', 'hu', 'is', 'id', 'it', 'ja', 'kk', 'km', 'ko', 'lo', 'lv', 'ln', 'lt', 'lb',
  'mk', 'mg', 'ms', 'mt', 'mi', 'mn', 'ne', 'no', 'ps', 'fa', 'pl', 'pt', 'ro', 'ru', 'sr', 'sn', 'si', 'sk', 'sl', 'so',
  'es', 'sw', 'sv', 'tl', 'tg', 'ta', 'th', 'tr', 'tk', 'uk', 'ur', 'uz', 'vi', 'yo',
]);

// POST /api/coach/voice
const transcribe = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file || !file.mimetype.startsWith('audio/')) throw ApiError.badRequest('Send a short audio recording.');

  const asked = req.query.language;
  let language;
  if (asked === 'auto') language = '';
  else if (VOICE_LANGUAGES.has(asked)) language = asked;

  const text = await transcribeAudio({ buffer: file.buffer, mimetype: file.mimetype, language });
  return sendSuccess(res, { data: { text } });
});

module.exports = {
  sendMessage,
  transcribe,
  deleteAllConversations,
  listConversations,
  getConversation,
  deleteConversation,
  getSubject,
  getHealth,
};
