const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, CALENDAR_DAY } = require('../shared');

const { Schema } = mongoose;

// Daily step counts, one document per user per calendar day.
// Stores calendar dates as "YYYY-MM-DD" strings 
// No data is not the same as zero recorded
const dailyStepsSchema = new Schema(
  {
    userId: USER_REF,

    // String, not date (see models/shared.js)
    activityDate: { ...CALENDAR_DAY, required: true },

    // "None recorded ≠ Recorded zero". An inactive week and 
    // a week of total immobility must stay distinguishable    
    stepCount: { type: Number, required: true, default: 0, min: 0, max: 200000 },
 
    distanceMeters: { type: Number, default: null, min: 0 },

    source: {
      type: String,
      enum: ['manual', 'healthkit', 'health_connect', 'device_sensor'],
      default: 'manual',
      required: true,
    },
    syncedAt: { type: Date, default: null },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'daily_steps' },
);

// Indexes are created by migrations 001, not declared here

// Fields the client needs
const PROJECTION = 'activityDate stepCount distanceMeters source syncedAt updatedAt';

/**
 * Handles overriding a manually typed number by the user (source: 'manual')
 * so future automatic syncs skip it -- upsertMany's first guard checks the
 * stored source and refuses to overwrite it with sensor data.
 *
 * @param {{ userId: string, source: string, days: Array<{ activityDate: string, stepCount: number, distanceMeters?: number|null }> }} input
 * @returns {Promise<Array<object>>} the documents actually inserted or changed
 */
dailyStepsSchema.statics.upsertMany = async function upsertMany(input, client) {
  const { userId, source, days } = input;
  if (!days || days.length === 0) return [];

  // One shared timestamp is used to both record save-time and later 
  // identify exactly which documents this batch call changed
  const now = new Date();

  const operations = days.map((day) => {
    const stepCount = day.stepCount;
    const distanceMeters = day.distanceMeters ?? null;

    return {
      updateOne: {
        // Identity only to avoid duplicate-key errors
        filter: { userId, activityDate: day.activityDate },
        update: [
          {
            $set: {
              userId,
              activityDate: day.activityDate,
              _allow: {
                $and: [
                  // Manual, no source, no updates
                  { $ne: [{ $ifNull: ['$source', null] }, 'manual'] },
                  // Only count this as a change if the value is different
                  // from what's already saved
                  {
                    $or: [
                      { $ne: [{ $ifNull: ['$stepCount', null] }, stepCount] },
                      { $ne: [{ $ifNull: ['$distanceMeters', null] }, distanceMeters] },
                    ],
                  },
                ],
              },
            },
          },
          {
            $set: {
              stepCount: { $cond: { if: '$_allow', then: stepCount, else: '$stepCount' } },
              distanceMeters: {
                $cond: { if: '$_allow', then: distanceMeters, else: '$distanceMeters' },
              },
              source: { $cond: { if: '$_allow', then: source, else: '$source' } },
              syncedAt: { $cond: { if: '$_allow', then: now, else: '$syncedAt' } },
              updatedAt: { $cond: { if: '$_allow', then: now, else: '$updatedAt' } },
            },
          },
          { $unset: '_allow' },
        ],
        upsert: true,
      },
    };
  });

  // ordered:false lets independent days proceed if one fails. They are
  // independent by construction -- different documents, no shared state
  await this.bulkWrite(operations, { ordered: false, ...opts(client) });

  // Bulk writes can't report back the actual changed documents (just counts), 
  // so this does one follow-up read, using the batch's unique shared timestamp to 
  // find exactly the documents that were really changed
  return this.find(
    {
      userId,
      activityDate: { $in: days.map((d) => d.activityDate) },
      updatedAt: now,
    },
    PROJECTION,
    opts(client),
  )
    .sort({ activityDate: 1 })
    .lean();
};

/**
 * Return steps oldest-first using string comparison (YYYY-MM-DD)
 * served by the unique index { userId: 1, activityDate: 1 }
 *
 * @param {{ userId: string, from: string, to: string }} input ISO YYYY-MM-DD
 */
dailyStepsSchema.statics.findRange = async function findRange(input, client) {
  return this.find(
    {
      userId: input.userId,
      activityDate: { $gte: input.from, $lte: input.to },
    },
    PROJECTION,
    opts(client),
  )
    .sort({ activityDate: 1 })
    .lean();
};

/** @param {{ userId: string, activityDate: string }} input */
dailyStepsSchema.statics.findByDate = async function findByDate(input, client) {
  return this.findOne(
    { userId: input.userId, activityDate: input.activityDate },
    PROJECTION,
    opts(client),
  ).lean();
};

/**
 * Set daily step log manually, rather than through syncing
 * Always overrides existing logs, and can't be overwritten by
 * the sync function in the same way (sourc: 'manual')
 * 
 * @param {{ userId: string, activityDate: string, stepCount: number }} input
 */
dailyStepsSchema.statics.setManual = async function setManual(input, client) {
  return this.findOneAndUpdate(
    { userId: input.userId, activityDate: input.activityDate },
    {
      $set: { stepCount: input.stepCount, source: 'manual', updatedAt: new Date() },
      $setOnInsert: { userId: input.userId, activityDate: input.activityDate },
    },
    {
      upsert: true,
      new: true,
      // Schema validators
      runValidators: true,
      projection: PROJECTION,
      ...opts(client),
    },
  ).lean();
};

module.exports = mongoose.model('DailySteps', dailyStepsSchema);