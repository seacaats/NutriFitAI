const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, withId } = require('../shared');

const { Schema } = mongoose;

const chatConversationSchema = new Schema(
  {
    userId: USER_REF,
    title: { type: String, maxlength: 150, default: null },
    surface: { type: String, enum: ['coach', 'food_scan'], default: 'coach', required: true },

    // Optional reference to the food scan or meal under discussion
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

chatConversationSchema.statics.findOwned = async function findOwned(input, client) {
  if (!mongoose.isValidObjectId(input.id)) return null;
  return withId(
    await this.findOne({ _id: input.id, userId: input.userId }, null, opts(client)).lean(),
  );
};

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

chatConversationSchema.statics.removeAllOwned = async function removeAllOwned(input, client) {
  const filter = { userId: input.userId, surface: input.surface || 'coach' };
  const ids = (await this.find(filter, '_id', opts(client)).lean()).map((c) => c._id);
  if (!ids.length) return 0;
  await mongoose.model('ChatMessage').deleteMany({ conversationId: { $in: ids } }, opts(client));
  const { deletedCount } = await this.deleteMany({ _id: { $in: ids } }, opts(client));
  return deletedCount;
};

chatConversationSchema.statics.touch = async function touch(id, title, client) {
  const set = { updatedAt: new Date() };
  if (title) set.title = title.slice(0, 150);
  await this.updateOne({ _id: id }, { $set: set }, opts(client));
};

chatConversationSchema.statics.removeOwned = async function removeOwned(input, client) {
  const owned = await this.findOwned(input, client);
  if (!owned) return false;

  await mongoose.model('ChatMessage').deleteMany({ conversationId: input.id }, opts(client));

  const { deletedCount } = await this.deleteOne({ _id: input.id, userId: input.userId }, opts(client));
  return deletedCount > 0;
};

module.exports = mongoose.model('ChatConversation', chatConversationSchema);