const { mongoose, opts } = require('../../../config/mongo');
const env = require('../../../config/env');
const { USER_REF, withId } = require('../shared');

const { Schema } = mongoose;

// OTP challenges for email verification and password reset
const authChallengeSchema = new Schema(
  {
    userId: USER_REF,
    purpose: { type: String, enum: ['email_verification', 'password_reset', 'login_mfa', 'mfa_change', 'email_change'], required: true },
    codeHash: { type: String, required: true }, // hash of the OTP, never plaintext
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    failedAttempts: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'auth_challenges' },
);

// Indexes are created by migrations 001, not declared here

// True when the challenge is unexpired and below the max failed attempt limit
authChallengeSchema.statics.isUsable = function isUsable(challenge) {
  return Boolean(challenge)
    && new Date(challenge.expiresAt).getTime() >= Date.now()
    && challenge.failedAttempts < env.otp.maxFailedAttempts;
};

authChallengeSchema.statics.issue = async function issue(input, client) {
  const [doc] = await this.create(
    [
      {
        userId: input.userId,
        purpose: input.purpose,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        consumedAt: null,
        failedAttempts: 0,
        createdAt: new Date(),
      },
    ],
    opts(client),
  );
  return withId(doc.toObject());
};

// Most recent unconsumed challenge, served by user_purpose_recent
authChallengeSchema.statics.findLatestActive = async function findLatestActive(userId, purpose, client) {
  return withId(
    await this.findOne({ userId, purpose, consumedAt: null }, null, opts(client))
      .sort({ createdAt: -1 })
      .lean(),
  );
};

// Malformed ids read as "not found" rather than a cast error (500)
authChallengeSchema.statics.getById = async function getById(id, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  return withId(await this.findById(id, null, opts(client)).lean());
};

// Invalidate active OTP codes before issuing new ones
authChallengeSchema.statics.invalidateActive = async function invalidateActive(userId, purpose, client) {
  await this.updateMany(
    { userId, purpose, consumedAt: null },
    { $set: { consumedAt: new Date() } },
    opts(client),
  );
};

authChallengeSchema.statics.incrementFailedAttempts = async function incrementFailedAttempts(id, client) {
  return withId(
    await this.findByIdAndUpdate(id, { $inc: { failedAttempts: 1 } }, { new: true, ...opts(client) }).lean(),
  );
};

// Atomically marks an unconsumed challenge as consumed
authChallengeSchema.statics.markConsumed = async function markConsumed(id, client) {
  return withId(
    await this.findOneAndUpdate(
      { _id: id, consumedAt: null },
      { $set: { consumedAt: new Date() } },
      { new: true, ...opts(client) },
    ).lean(),
  );
};

module.exports = mongoose.model('AuthChallenge', authChallengeSchema);