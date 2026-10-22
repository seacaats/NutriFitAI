const { mongoose, opts } = require('../../../config/mongo');
const { withId } = require('../shared');

const { Schema } = mongoose;

const chatMessageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatConversation',
      required: true,
    },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    provider: { type: String, maxlength: 30, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'chat_messages' },
);

chatMessageSchema.statics.append = async function append(input, client) {
  const [doc] = await this.create(
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
  return withId(doc.toObject());
};

// Fetch latest N messages and return in chronological order
chatMessageSchema.statics.listByConversation = async function listByConversation(input, client) {
  const rows = await this.find(
    { conversationId: input.conversationId },
    'role content provider createdAt',
    opts(client),
  )
    .sort({ createdAt: -1 })
    .limit(input.limit || 100)
    .lean();
  return rows.reverse().map(withId);
};

// Replace an unanswered user message on retry so failed turns do not accumulate
chatMessageSchema.statics.overwrite = async function overwrite(id, content, client) {
  const doc = await this.findOneAndUpdate(
    { _id: id, role: 'user' },
    { $set: { content, createdAt: new Date() } },
    { new: true, ...opts(client) },
  ).lean();
  return doc ? withId(doc) : null;
};

module.exports = mongoose.model('ChatMessage', chatMessageSchema);