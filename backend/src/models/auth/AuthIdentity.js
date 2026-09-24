const db = require('../../../config/mongo');
const { AuthIdentity: AuthIdentityDoc } = require('../schemas');

const { opts } = db;

function shape(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

// Provider identity have separate collections rather than being embedded
// on the user. Enforcing uniqueness on two top-level fields is just easier
// to manage and less messier is all
const AuthIdentity = {
  async findByProviderSubject(provider, providerSubject, client = db) {
    return shape(
      await AuthIdentityDoc.findOne({ provider, providerSubject }, null, opts(client)).lean(),
    );
  },

  async create(input, client = db) {
    const [doc] = await AuthIdentityDoc.create(
      [
        {
          userId: input.userId,
          provider: input.provider,
          providerSubject: input.providerSubject,
        },
      ],
      opts(client),
    );
    return shape(doc.toObject());
  },

  // Link a provider identity (Just Google right now) to a user
  // setOnInsert makes it so this function can change who
  // an already-linked identity belongs to
  async link(input, client = db) {
    await AuthIdentityDoc.updateOne(
      { provider: input.provider, providerSubject: input.providerSubject },
      { $setOnInsert: { userId: input.userId } },
      { upsert: true, runValidators: true, ...opts(client) },
    );
  },

  async findByUserId(userId, client = db) {
    const rows = await AuthIdentityDoc.find({ userId }, null, opts(client)).lean();
    return rows.map(shape);
  },
};

module.exports = AuthIdentity;