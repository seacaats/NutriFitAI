const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF } = require('../shared');

const { Schema } = mongoose;

// Expo push tokens per device; unique across users so signing into another account reassigns the token
const pushTokenSchema = new Schema(
  {
    userId: USER_REF,
    token: { type: String, required: true, maxlength: 200 },
    platform: { type: String, enum: ['ios', 'android'], required: true },
    lastSeenAt: { type: Date, default: () => new Date() },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'push_tokens' },
);

// Upsert token and assign to userId; returns true if newly assigned to this user
pushTokenSchema.statics.register = async function register({ userId, token, platform }, client) {
  const before = await this.findOneAndUpdate(
    { token },
    { $set: { userId, platform, lastSeenAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: false, ...opts(client) },
  ).lean();
  return !before || before.userId !== userId;
};

pushTokenSchema.statics.revoke = async function revoke(userId, token, client) {
  const result = await this.deleteOne({ userId, token }, opts(client));
  return result.deletedCount > 0;
};

pushTokenSchema.statics.removeToken = async function removeToken(token, client) {
  return this.findOneAndDelete({ token }, opts(client)).lean();
};

pushTokenSchema.statics.listFor = async function listFor(userId, client) {
  return this.find({ userId }, 'token platform', opts(client)).lean();
};

pushTokenSchema.statics.removeStale = async function removeStale(before, client) {
  const result = await this.deleteMany({ lastSeenAt: { $lt: before } }, opts(client));
  return result.deletedCount;
};

module.exports = mongoose.model('PushToken', pushTokenSchema);
