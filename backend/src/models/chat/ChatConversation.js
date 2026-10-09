const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, withId } = require('../shared');

const { Schema } = mongoose;

const chatConversationSchema = new Schema(
  {
    userId: USER_REF,
    title: { type: String, maxlength: 150, default: null },

    // Says which UI opened the conversation. "Ask AI Coach" on the food
    // scanner opens the coach, so those threads are 'coach' too
    surface: { type: String, enum: ['coach', 'food_scan'], default: 'coach', required: true },

    // What the thread is about, at most one of the two. The coach reads the
    // scan or meal itself on every turn (contextBuilder), never a client copy
    scanRef: {
      type: new Schema({ scanId: { type: Schema.Types.ObjectId, required: true } }, { _id: false }),
      default: null,
    },
    mealRef: {
      type: new Schema({ mealId: { type: Schema.Types.ObjectId, required: true } }, { _id: false }),
      default: null,
    },

    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'chat_conversations' },
);

// Indexes are created by migrations 001, 003, not declared here

chatConversationSchema.statics.start = async function start(input, client) {
  const now = new Date();
  const [doc] = await this.create(
    [
      {
        userId: input.userId,
        surface: input.surface || 'coach',
        title: input.title ?? null,
        scanRef: input.scanId ? { scanId: input.scanId } : null,
        mealRef: input.mealId ? { mealId: input.mealId } : null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    opts(client),
  );
  return withId(doc.toObject());
};

// Ownership is part of the query itself. Malformed ids, "not found" and
// "not yours" all come back null, so none of them can surface as a 500
chatConversationSchema.statics.findOwned = async function findOwned(input, client) {
  if (!mongoose.isValidObjectId(input.id)) return null;
  return withId(
    await this.findOne({ _id: input.id, userId: input.userId }, null, opts(client)).lean(),
  );
};

// Served by { userId: 1, surface: 1, updatedAt: -1 }
chatConversationSchema.statics.listByUser = async function listByUser(input, client) {
  const rows = await this.find(
    { userId: input.userId, surface: input.surface || 'coach' },
    'title surface createdAt updatedAt',
    opts(client),
  )
    .sort({ updatedAt: -1 })
    .limit(input.limit || 30)
    .lean();
  return rows.map(withId);
};

chatConversationSchema.statics.countByUser = async function countByUser(input, client) {
  return this.countDocuments({ userId: input.userId, surface: input.surface || 'coach' }, opts(client));
};

// Every conversation (and its messages) for one user on one surface
chatConversationSchema.statics.removeAllOwned = async function removeAllOwned(input, client) {
  const filter = { userId: input.userId, surface: input.surface || 'coach' };
  const ids = (await this.find(filter, '_id', opts(client)).lean()).map((c) => c._id);
  if (!ids.length) return 0;
  await mongoose.model('ChatMessage').deleteMany({ conversationId: { $in: ids } }, opts(client));
  const { deletedCount } = await this.deleteMany({ _id: { $in: ids } }, opts(client));
  return deletedCount;
};

// Update a conversation's timestamp
chatConversationSchema.statics.touch = async function touch(id, client) {
  await this.updateOne({ _id: id }, { $set: { updatedAt: new Date() } }, opts(client));
};

// Auto-generate titles from a user's first message, scanning
// only conversations with empty titles
chatConversationSchema.statics.setTitleIfEmpty = async function setTitleIfEmpty(id, title, client) {
  return withId(
    await this.findOneAndUpdate(
      { _id: id, title: null },
      { $set: { title: title.slice(0, 150) } },
      { new: true, runValidators: true, ...opts(client) },
    ).lean(),
  );
};

// Deletes the conversation and its messages, the latter first.
// Ownership is re-checked rather than trusted from the caller
chatConversationSchema.statics.removeOwned = async function removeOwned(input, client) {
  const owned = await this.findOwned(input, client);
  if (!owned) return false;

  await mongoose.model('ChatMessage').deleteMany({ conversationId: input.id }, opts(client));

  const { deletedCount } = await this.deleteOne({ _id: input.id, userId: input.userId }, opts(client));
  return deletedCount > 0;
};

module.exports = mongoose.model('ChatConversation', chatConversationSchema);