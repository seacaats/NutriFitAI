const env = require('../../../config/env');
const router = require('./router');
const { buildCoachContext } = require('./contextBuilder');

// Boundary layer (module) for coachController.js

// The set conversation limit for each user
const HISTORY_TURNS = env.ai.historyTurns;

/**
 * The app shows replies as plain text, so Markdown the model adds anyway
 * would show as literal symbols. Strips it to the words, keeps line breaks,
 * and turns list markers into "• "
 */
function toPlainText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    // Code fences and inline code: keep the code, drop the backticks
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/`([^`]+)`/g, '$1')
    // Headings and block quotes
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]{0,3}>[ \t]?/gm, '')
    // Bold and italic (** __ * _ around words)
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1$2')
    .replace(/(^|[^\w_])_(?!\s)([^_\n]+?)_(?!\w)/g, '$1$2')
    // Links: keep the text and the address
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    // Bullets, including nested ones
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
    // Horizontal rules and table pipes
    .replace(/^[ \t]*([-*_])\1{2,}[ \t]*$/gm, '')
    .replace(/^[ \t]*\|?([ \t]*:?-{3,}:?[ \t]*\|)+[ \t]*\n?/gm, '')
    .replace(/^\|(.*)\|$/gm, (_, row) => row.split('|').map((c) => c.trim()).join(' · '))
    // Leftover stray asterisks, then tidy blank lines
    .replace(/\*{2,}/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * `ref` is the scan or meal the thread is about ({ scanId } / { mealId }),
 * or empty for a general chat
 * @param {{ userId: string, ref?: object, history: Array<{ role: string, content: string }>, message: string, signal?: AbortSignal }} input
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
async function coachReply(input) {
  const { system } = await buildCoachContext(input.userId, input.ref);

  const messages = [
    ...input.history
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: input.message },
  ];

  const reply = await router.chat({ system, messages, signal: input.signal });
  // Normalised before it's stored or shown
  return { ...reply, text: toPlainText(reply.text) };
}

module.exports = { coachReply, toPlainText, health: router.health, HISTORY_TURNS };