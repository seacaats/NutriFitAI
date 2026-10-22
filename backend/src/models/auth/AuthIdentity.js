const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, withId } = require('../shared');

const { Schema } = mongoose;

// External OAuth provider identities linked to user accounts
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

// Links a provider identity to a user ($setOnInsert prevents reassigning an existing link)
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