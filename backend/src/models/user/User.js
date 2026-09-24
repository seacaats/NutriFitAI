const db = require('../../../config/mongo');
const { User: UserDoc } = require('../schemas');

const { opts } = db;

/**
 * Users, with user_profiles and user_goals embedded.
 *
 * Both were 1:1 or small-and-bounded against a document read on nearly every
 * authenticated request, so embedding removes two joins from the hottest path.
 * On a cluster capped at 100 operations per second, removing round trips is
 * worth more than it would be on a dedicated Postgres box.
 *
 * The visible consequence elsewhere: registration no longer needs a transaction
 * to create user + profile + initial goal. Those are now one document and one
 * insert. Only the initial weight log and the OTP challenge remain outside it.
 */

/** Fields never sent anywhere. Applied at the model boundary, not per caller. */
const PRIVATE_FIELDS = '-passwordHash';

/**
 * Normalises a lean document.
 *
 * Callers say `user.id`. Keeping `_id` out of the returned object means no call
 * site has to know it is talking to Mongo, and no response can leak the raw
 * field shape by accident.
 */
function shape(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

/**
 * Neutralises regex metacharacters in a user-supplied search string.
 *
 * Without this, a search for "a(" throws (unbalanced group) and a search for
 * "(a+)+$" is a catastrophic-backtracking denial of service -- against a
 * collection only an admin can query, but an admin account is exactly the one
 * worth not handing a remote hang. Escaping turns every such input into a
 * literal, which is also what a person typing into a search box expects.
 */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const User = {
  /**
   * Email is lowercased on every read and write.
   *
   * The unique index is case-SENSITIVE, so this normalisation IS the
   * case-insensitivity. Drop it and alice@x.com and Alice@x.com both register
   * successfully as different accounts.
   */
  async findByEmail(email, client = db) {
    return shape(
      await UserDoc.findOne({ email: email.toLowerCase() }, null, opts(client)).lean(),
    );
  },

  async findById(id, client = db) {
    return shape(await UserDoc.findById(id, null, opts(client)).lean());
  },

  /** Same as findById but guarantees the hash never leaves the model. */
  async findByIdSafe(id, client = db) {
    return shape(await UserDoc.findById(id, PRIVATE_FIELDS, opts(client)).lean());
  },

  /**
   * Creates the user together with their profile and initial goal.
   *
   * Under Postgres this was three inserts inside a transaction. Here it is one
   * document, so the atomicity is structural rather than transactional -- there
   * is no window in which a user exists without a profile.
   *
   * @param {{ email: string, passwordHash: string|null, fullName?: string,
   *           firstName?: string, lastName?: string, termsAcceptedAt?: Date|null,
   *           profile?: object, initialGoal?: object }} input
   */
  async create(input, client = db) {
    const [doc] = await UserDoc.create(
      [
        {
          email: input.email.toLowerCase(),
          passwordHash: input.passwordHash,
          fullName: input.fullName || null,
          firstName: input.firstName || null,
          lastName: input.lastName || null,
          termsAcceptedAt: input.termsAcceptedAt || null,
          createdAt: new Date(),
          profile: input.profile || {},
          goals: input.initialGoal ? [input.initialGoal] : [],
        },
      ],
      opts(client),
    );
    return shape(doc.toObject());
  },

  /**
   * Updates the display name columns.
   *
   * fullName is what the UI shows; the split first/last fields exist for
   * sorting and greetings. All three are written together so they cannot drift
   * apart -- a user who edits only their surname would otherwise keep a stale
   * fullName forever.
   */
  async updateNames(id, names, client = db) {
    return shape(
      await UserDoc.findByIdAndUpdate(
        id,
        {
          $set: {
            fullName: names.fullName || null,
            firstName: names.firstName || null,
            lastName: names.lastName || null,
          },
        },
        { new: true, runValidators: true, ...opts(client) },
      ).lean(),
    );
  },

  async markEmailVerified(id, client = db) {
    return shape(
      await UserDoc.findByIdAndUpdate(
        id,
        { $set: { emailVerifiedAt: new Date() } },
        { new: true, ...opts(client) },
      ).lean(),
    );
  },

  async updatePasswordHash(id, passwordHash, client = db) {
    return shape(
      await UserDoc.findByIdAndUpdate(
        id,
        { $set: { passwordHash } },
        { new: true, ...opts(client) },
      ).lean(),
    );
  },

  /** Cheaper than findByEmail when only existence matters. */
  async existsByEmail(email, client = db) {
    const found = await UserDoc.exists({ email: email.toLowerCase() }).session(
      opts(client).session || null,
    );
    return Boolean(found);
  },

  /**
   * Was a JOIN against auth_identities.
   *
   * Two queries rather than a $lookup, deliberately: the identity lookup is
   * served by a unique index and returns at most one document, so the second
   * query is a primary-key fetch. A $lookup would be one round trip instead of
   * two but produces a less readable pipeline for no measurable gain at this
   * cardinality.
   */
  async findByProviderIdentity(provider, providerSubject, client = db) {
    const { AuthIdentity: AuthIdentityDoc } = require('../schemas');
    const identity = await AuthIdentityDoc.findOne(
      { provider, providerSubject },
      'userId',
      opts(client),
    ).lean();
    if (!identity) return null;
    return User.findById(identity.userId, client);
  },

  // -------------------------------------------------------------------------
  // Admin surface
  // -------------------------------------------------------------------------

  /**
   * Paginated directory for the users management table.
   *
   * `search` matches email OR name, case-insensitively via a regex. That is a
   * deliberate downgrade from what the workouts collection does, and the
   * reason is the one-text-index-per-collection cap: users already spends its
   * index budget on the unique email index and the privileged-role partial,
   * and a text index here would be a third. A regex scan is fine at this
   * cardinality (an admin searching a user directory, not a hot path), and
   * anchoring the pattern keeps it from degrading into a full-collection
   * regex on every keystroke -- see escapeRegex below for the injection point
   * that closes.
   *
   * @param {{ search?: string, role?: string|null, page?: number, limit?: number }} query
   */
  async listPaginated(query = {}, client = db) {
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const page = Math.max(Number(query.page) || 1, 1);

    const filter = {};
    if (query.role) filter.role = query.role;
    if (query.search) {
      const pattern = escapeRegex(query.search.trim());
      if (pattern) {
        filter.$or = [
          { email: { $regex: pattern, $options: 'i' } },
          { fullName: { $regex: pattern, $options: 'i' } },
        ];
      }
    }

    const [docs, total] = await Promise.all([
      UserDoc.find(filter, PRIVATE_FIELDS, opts(client))
        // Matches the users_recent index. Without it this sort is uncovered,
        // and an uncovered sort on Atlas M0 fails outright past 32 MB rather
        // than running slowly.
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UserDoc.countDocuments(filter).session(opts(client).session || null),
    ]);

    return {
      rows: docs.map(shape),
      page,
      limit,
      total,
      pageCount: Math.max(Math.ceil(total / limit), 1),
    };
  },

  /**
   * Headline counts for the cards above the users table.
   *
   * One aggregation rather than three countDocuments calls: on a cluster
   * capped at 100 ops/sec, three round trips to render three numbers is the
   * kind of thing that is invisible in development and measurable in
   * production.
   */
  async countByRole(client = db) {
    const rows = await UserDoc.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]).session(opts(client).session || null);

    return rows.reduce((acc, row) => {
      acc[row._id || 'user'] = row.count;
      return acc;
    }, {});
  },

  /**
   * Sets a user's role. The authorization decision (who may grant what) is
   * NOT here -- it lives in adminController, where the actor is known. A model
   * method that enforced it would have to be told the actor's role anyway,
   * and would then be a second place for that rule to drift.
   *
   * runValidators is explicit because the role enum lives on the schema and
   * findByIdAndUpdate skips document validation by default -- the standing gap
   * this project documents for workout_sessions' kind XOR. Without it, a typo
   * writes an unknown role straight past the enum and requireRole then fails
   * closed for an account nobody can fix from the UI.
   */

  // Set a users role 
  async updateRole(id, role, client = db) {
    return shape(
      await UserDoc.findByIdAndUpdate(
        id,
        { $set: { role } },
        { new: true, runValidators: true, fields: PRIVATE_FIELDS, ...opts(client) },
      ).lean(),
    );
  },



  // Create a passwordless user
  // Ignore
  async createFromProvider(input, client = db) {
    const [doc] = await UserDoc.create(
      [
        {
          email: input.email.toLowerCase(),
          passwordHash: null,
          fullName: input.fullName || null,
          emailVerifiedAt: new Date(),
          createdAt: new Date(),
          profile: {},
          goals: [],
        },
      ],
      opts(client),
    );
    return shape(doc.toObject());
  },
};

module.exports = User;