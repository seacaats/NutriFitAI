const db = require('../../../config/mongo');
const { ChatConversationDoc } = require('../schemas');

const { opts } = db;

// Lean document for callers. Models speak "id", the database, "_id",
// ObjetedId are stringified a more streamlined process

function shape(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

const ChatConversation = {
  /**
   * @param {{ userId: string, surface?: string, title?: string|null }} input
   */
  async create(input, client = db) {
    const now = new Date();
    const [doc] = await ChatConversationDoc.create(
      [
        {
          userId: input.userId,
          surface: input.surface || 'coach',
          title: input.title ?? null,
          createdAt: now,
          updatedAt: now,
        },
      ],
      opts(client),
    );
    return shape(doc.toObject());
  },

  /**
   * Scoped by userId and converstionId, where ownership 
   * is checked as part of the database query itself
   *
   * @param {{ id: string, userId: string }} input
   */
  async findOwned(input, client = db) {
    // Check for malformed ids and treat "not found" and "not yours" identically
    // Since any detections here may return a "500" when it shouldn't
    // return anything like that back to the client
    if (!ChatConversationDoc.base.isValidObjectId(input.id)) return null;

    return shape(
      await ChatConversationDoc.findOne(
        { _id: input.id, userId: input.userId },
        null,
        opts(client),
      ).lean(),
    );
  },

  // Served by { userId: 1, surface: 1, updatedAt: -1 }.
  async listByUser(input, client = db) {
    const rows = await ChatConversationDoc.find(
      { userId: input.userId, surface: input.surface || 'coach' },
      'title surface createdAt updatedAt',
      opts(client),
    )
      .sort({ updatedAt: -1 })
      .limit(input.limit || 30)
      .lean();

    return rows.map(shape);
  },

  // Update a conversation's timestamp
  async touch(id, client = db) {
    await ChatConversationDoc.updateOne(
      { _id: id },
      { $set: { updatedAt: new Date() } },
      opts(client),
    );
  },

  // Auto-generate titles from a user's first message, scanning
  // only conversations with empty titles
  async setTitleIfEmpty(id, title, client = db) {
    return shape(
      await ChatConversationDoc.findOneAndUpdate(
        { _id: id, title: null },
        { $set: { title: title.slice(0, 150) } },
        { new: true, runValidators: true, ...opts(client) },
      ).lean(),
    );
  },

  /**
   * Delete the conversation and its messages, the latter first 
   * 
   * @param {{ id: string, userId: string }} input
   */
  async remove(input, client = db) {
    if (!ChatConversationDoc.base.isValidObjectId(input.id)) return false;

    // Ownership is re-checked rather than trusted from the caller
    const owned = await ChatConversation.findOwned(input, client);
    if (!owned) return false;

    const { ChatMessageDoc } = require('../schemas');
    await ChatMessageDoc.deleteMany({ conversationId: input.id }, opts(client));

    const { deletedCount } = await ChatConversationDoc.deleteOne(
      { _id: input.id, userId: input.userId },
      opts(client),
    );
    return deletedCount > 0;
  },
};

module.exports = ChatConversation;