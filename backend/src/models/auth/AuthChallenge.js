const db = require('../../../config/mongo');
const { AuthChallenge: AuthChallengeDoc } = require('../schemas');

const { opts } = db;

function shape(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

//OTP challenges for email verification and password reset.
//The collection carries a TTL index on expiresAt (expireAfterSeconds: 0), so
//expired challenges delete themselves. Note that TTL monitors run every 60 seconds
 
const AuthChallenge = {
  /**
   * @param {{ userId: string, purpose: 'email_verification'|'password_reset',
   *           codeHash: string, expiresAt: Date }} input
   */
  async create(input, client = db) {
    const [doc] = await AuthChallengeDoc.create(
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
    return shape(doc.toObject());
  },

  // Served by { userId: 1, purpose: 1, createdAt: -1 }
  // to find the most recent unconsumed challenge by a user
  async findLatestActive(userId, purpose, client = db) {
    return shape(
      await AuthChallengeDoc.findOne(
        { userId, purpose, consumedAt: null },
        null,
        opts(client),
      )
        .sort({ createdAt: -1 })
        .lean(),
    );
  },

  async findById(id, client = db) {
    if (!AuthChallengeDoc.base.isValidObjectId(id)) return null;
    return shape(await AuthChallengeDoc.findById(id, null, opts(client)).lean());
  },

  // Invalidate active OTP codes before issuing new ones
  async invalidateActive(userId, purpose, client = db) {
    await AuthChallengeDoc.updateMany(
      { userId, purpose, consumedAt: null },
      { $set: { consumedAt: new Date() } },
      opts(client),
    );
  },

  async incrementFailedAttempts(id, client = db) {
    return shape(
      await AuthChallengeDoc.findByIdAndUpdate(
        id,
        { $inc: { failedAttempts: 1 } },
        { new: true, ...opts(client) },
      ).lean(),
    );
  },

  // Checks and marks a code as used so any concurrent verification
  // attempts with the same code can't succeed or fail at the same time
  async markConsumed(id, client = db) {
    return shape(
      await AuthChallengeDoc.findOneAndUpdate(
        { _id: id, consumedAt: null },
        { $set: { consumedAt: new Date() } },
        { new: true, ...opts(client) },
      ).lean(),
    );
  },
};

module.exports = AuthChallenge;