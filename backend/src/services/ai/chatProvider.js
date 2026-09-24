const env = require('../../../config/env');
const router = require('./router');
const { buildCoachContext } = require('./contextBuilder');

// Boundary layer (module) for coachController.js

// The set conversation limit for each user
const HISTORY_TURNS = env.ai.historyTurns;

/**
 * @param {{ userId: string, history: Array<{ role: string, content: string }>, message: string, signal?: AbortSignal }} input
 * @returns {Promise<{ text: string, provider: string, model: string }>}
 */
async function coachReply(input) {
  const { system } = await buildCoachContext(input.userId);

  const messages = [
    ...input.history
      .slice(-HISTORY_TURNS)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: input.message },
  ];

  return router.chat({ system, messages, signal: input.signal });
}

module.exports = { coachReply, health: router.health, HISTORY_TURNS };
