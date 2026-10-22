const env = require('../../../config/env');
const router = require('./router');
const { buildCoachContext } = require('./contextBuilder');
const { detectConcerns, fallbackReply } = require('./safetyRules');

const HISTORY_TURNS = env.ai.historyTurns;
const MAX_HISTORY_CHARS = 1500;
const EMPTY_REPLY = 'Sorry, I could not put that into words. Could you ask again?';

/**
 * Normalizes stored messages for the model: keeps non-empty user/assistant
 * turns, merges adjacent same-role turns, and ensures the thread opens with a user turn.
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
 * Strips Markdown formatting into plain text, preserving line breaks and converting list markers to "• ".
 */
function toPlainText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    // Code fences and inline code
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/`([^`]+)`/g, '$1')
    // Headings and block quotes
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]{0,3}>[ \t]?/gm, '')
    // Bold and italic
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1$2')
    .replace(/(^|[^\w_])_(?!\s)([^_\n]+?)_(?!\w)/g, '$1$2')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    // Bullets
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
    // Horizontal rules and table pipes
    .replace(/^[ \t]*([-*_])\1{2,}[ \t]*$/gm, '')
    .replace(/^[ \t]*\|?([ \t]*:?-{3,}:?[ \t]*\|)+[ \t]*\n?/gm, '')
    .replace(/^\|(.*)\|$/gm, (_, row) => row.split('|').map((c) => c.trim()).join(' · '))
    // Stray asterisks and extra blank lines
    .replace(/\*{2,}/g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * @param {{ userId: string, ref?: object, history: Array<{ role: string, content: string }>, message: string, signal?: AbortSignal }} input
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
async function coachReply(input) {
  // Detect concerns across the current and recent user messages
  const recent = input.history.filter((m) => m.role === 'user').map((m) => m.content);
  const concerns = detectConcerns(input.message, recent);

  const { system, timeZone } = await buildCoachContext(input.userId, input.ref, concerns, input.message);

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
    // Return static safety reply on provider failure when self-harm is detected
    if (!concerns.includes('selfHarm') || input.signal?.aborted) throw err;
    return { text: fallbackReply(timeZone), provider: 'safety', model: 'static' };
  }

  return { ...reply, text: toPlainText(reply.text) || EMPTY_REPLY };
}

module.exports = { coachReply, toPlainText, health: router.health, HISTORY_TURNS };
