const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, CALENDAR_DAY } = require('../shared');

const { Schema } = mongoose;

// Daily step counts per user per calendar day ("YYYY-MM-DD")
const dailyStepsSchema = new Schema(
  {
    userId: USER_REF,
    activityDate: { ...CALENDAR_DAY, required: true },
    stepCount: { type: Number, required: true, default: 0, min: 0, max: 20000 },
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

const PROJECTION = 'activityDate stepCount distanceMeters source syncedAt updatedAt';

// Batch-upsert sensor step counts without overwriting manual entries
dailyStepsSchema.statics.upsertMany = async function upsertMany(input, client) {
  const { userId, source, days } = input;
  if (!days || days.length === 0) return [];

  // Shared timestamp identifies documents modified by this batch
  const now = new Date();

  const operations = days.map((day) => {
    const stepCount = day.stepCount;
    const distanceMeters = day.distanceMeters ?? null;

    return {
      updateOne: {
        filter: { userId, activityDate: day.activityDate },
        update: [
          {
            $set: {
              userId,
              activityDate: day.activityDate,
              _allow: {
                $and: [
                  { $ne: [{ $ifNull: ['$source', null] }, 'manual'] },
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

  await this.bulkWrite(operations, { ordered: false, ...opts(client) });

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

dailyStepsSchema.statics.findByDate = async function findByDate(input, client) {
  return this.findOne(
    { userId: input.userId, activityDate: input.activityDate },
    PROJECTION,
    opts(client),
  ).lean();
};

// Manually set step count for a day (overrides sensor data and locks source to 'manual')
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
      runValidators: true,
      projection: PROJECTION,
      ...opts(client),
    },
  ).lean();
};

module.exports = mongoose.model('DailySteps', dailyStepsSchema);