const db = require('../../../config/mongo');
const { ChatMessageDoc } = require('../schemas');

const { opts } = db;

function shape(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

// Messages are their own collection since conversations are unbounded,
// and embedding would enforce the 16 MB document ceiling.
// Rentention is a 180-day TTL index on createdAt (for now), since 
// contextBuilder replays only AI_HISTORY_TURNS to the model
const ChatMessage = {
  /**
   * @param {{ conversationId: string, role: 'user'|'assistant', content: string, provider?: string|null }} input
   */
  async create(input, client = db) {
    const [doc] = await ChatMessageDoc.create(
      [
        {
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
          provider: input.provider ?? null,
          createdAt: new Date(),
        },
      ],
      opts(client),
    );
    return shape(doc.toObject());
  },

  
  // Oldest first (render order). Limited because the thread is unbounded but
  // chatProvider only replays recent turns. Sorted DESCENDING so limit grabs
  // the newest N (not the oldest), then .reverse()'d in memory to restore
  // oldest-first display order.
  async listByConversation(input, client = db) {
    const rows = await ChatMessageDoc.find(
      { conversationId: input.conversationId },
      'role content provider createdAt',
      opts(client),
    )
      .sort({ createdAt: -1 })
      .limit(input.limit || 100)
      .lean();

    return rows.reverse().map(shape);
  },
};

module.exports = ChatMessage;