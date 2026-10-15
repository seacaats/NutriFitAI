const env = require('../../../config/env');
const router = require('./router');
const { buildCoachContext } = require('./contextBuilder');
const { detectConcerns, fallbackReply } = require('./safetyRules');

// Boundary layer (module) for coachController.js

// The set conversation limit for each user
const HISTORY_TURNS = env.ai.historyTurns;

// One pasted wall of text must not crowd the rest of the thread out of the context
const MAX_HISTORY_CHARS = 1500;

// Shown instead of storing an empty reply, which would poison the later turns
const EMPTY_REPLY = 'Sorry, I could not put that into words. Could you ask again?';

/**
 * Turns stored messages into what the model can take: only user/assistant
 * turns with text, same-role neighbours merged, and starting on a user turn
 * (some providers reject a thread that opens with the assistant). The cut at
 * HISTORY_TURNS can land mid-exchange, which is why the start is fixed here
 */
function cleanMessages(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const content = String(m.content || '').trim();
    if (!content) continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role) prev.content += `\n${content}`;
    else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

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
  // Concerns come from this message and the user's recent ones, so a distress
  // message keeps shaping the replies after it
  const recent = input.history.filter((m) => m.role === 'user').map((m) => m.content);
  const concerns = detectConcerns(input.message, recent);

  const { system, timeZone } = await buildCoachContext(input.userId, input.ref, concerns);

  const messages = cleanMessages([
    ...input.history
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: String(m.content || '').slice(0, MAX_HISTORY_CHARS) })),
    { role: 'user', content: input.message },
  ]);

  let reply;
  try {
    reply = await router.chat({ system, messages, signal: input.signal });
  } catch (err) {
    // Someone in distress never gets a bare error. A cancelled request stays one
    if (!concerns.includes('selfHarm') || input.signal?.aborted) throw err;
    return { text: fallbackReply(timeZone), provider: 'safety', model: 'static' };
  }

  // Normalised before it's stored or shown
  return { ...reply, text: toPlainText(reply.text) || EMPTY_REPLY };
}

module.exports = { coachReply, toPlainText, health: router.health, HISTORY_TURNS };