const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, withId } = require('../shared');

const { Schema } = mongoose;

// Provider identities have their own collection rather than being embedded
// on the user. A compound unique index across two top-level fields keeps
// duplicate-key errors and similar issues interpretable
const authIdentitySchema = new Schema(
  {
    userId: USER_REF,
    provider: { type: String, enum: ['google', 'facebook'], required: true },
    providerSubject: { type: String, required: true, maxlength: 255 },
  },
  { versionKey: false, collection: 'auth_identities' },
);

// Indexes are created by migrations 001, not declared here

authIdentitySchema.statics.findByProviderSubject = async function findByProviderSubject(
  provider,
  providerSubject,
  client,
) {
  return withId(await this.findOne({ provider, providerSubject }, null, opts(client)).lean());
};

// Link a provider identity (Just Google right now) to a user.
// $setOnInsert means an already-linked identity never changes owner
authIdentitySchema.statics.link = async function link(input, client) {
  await this.updateOne(
    { provider: input.provider, providerSubject: input.providerSubject },
    { $setOnInsert: { userId: input.userId } },
    { upsert: true, runValidators: true, ...opts(client) },
  );
};

authIdentitySchema.statics.findByUserId = async function findByUserId(userId, client) {
  const rows = await this.find({ userId }, null, opts(client)).lean();
  return rows.map(withId);
};

module.exports = mongoose.model('AuthIdentity', authIdentitySchema);