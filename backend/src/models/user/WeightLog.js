const db = require('../../../config/mongo');
const { WeightLogDoc } = require('../schemas');

const { opts } = db;

/**
 * Weight is a time series, never a column on the user.
 *
 * This is a product decision, not a storage one: the profile screen edits what
 * looks like a single "weight" field, but a change there creates a new entry
 * here rather than overwriting. That is what makes "am I trending down?"
 * answerable at all, and it is why contextBuilder can summarise a 30-day trend
 * for the coach.
 *
 * Kept in its own collection rather than embedded in the user document because
 * it is genuinely unbounded -- a daily logger produces 365 entries a year, and
 * embedding would grow the hottest document in the database on every weigh-in.
 */
const WeightLog = {
  /**
   * @param {{ userId: string, weightKg: number }} input
   * @param {import('mongoose').ClientSession} [client]
   */
  async create(input, client = db) {
    const doc = await WeightLogDoc.create(
      [{ userId: input.userId, weightKg: input.weightKg, measuredAt: new Date() }],
      opts(client),
    );
    return doc[0].toObject();
  },

  /**
   * Served by { userId: 1, measuredAt: -1 }.
   *
   * The index is not optional here. Free-tier Atlas caps in-memory sorts at
   * 32 MB with allowDiskUse ignored, so an uncovered sort does not run slowly
   * -- it fails outright.
   */
  async findLatestByUserId(userId, client = db) {
    return WeightLogDoc.findOne({ userId }, null, opts(client))
      .sort({ measuredAt: -1 })
      .lean();
  },
};

module.exports = WeightLog;