const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF } = require('../shared');

const { Schema } = mongoose;

// One row per device that may receive push. The token is Expo's
// ("ExponentPushToken[...]"), unique across users: a phone that signs into
// a second account moves its token to that account
const pushTokenSchema = new Schema(
  {
    userId: USER_REF,
    token: { type: String, required: true, maxlength: 200 },
    platform: { type: String, enum: ['ios', 'android'], required: true },
    // Refreshed on every app launch. Tokens unseen for 60 days are deleted
    // by the scheduler, since the app was most likely uninstalled
    lastSeenAt: { type: Date, default: () => new Date() },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'push_tokens' },
);

// Indexes are created by migrations/004_nutrifitai.js, not declared here

// Insert or move to this user. Returns whether it was new to this user
pushTokenSchema.statics.register = async function register({ userId, token, platform }, client) {
  const before = await this.findOneAndUpdate(
    { token },
    { $set: { userId, platform, lastSeenAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true, new: false, ...opts(client) },
  ).lean();
  return !before || before.userId !== userId;
};

// Only the owner can remove a token, so one user can't unregister another's phone
pushTokenSchema.statics.revoke = async function revoke(userId, token, client) {
  const result = await this.deleteOne({ userId, token }, opts(client));
  return result.deletedCount > 0;
};

// Expo answered DeviceNotRegistered: the token is dead whoever owns it
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