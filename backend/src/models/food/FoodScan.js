const { mongoose, opts } = require('../../../config/mongo');
const { USER_REF, withId } = require('../shared');

const { Schema } = mongoose;

// Food detection scans; item nutrition is stored per default serving and per 100g
const foodScanSchema = new Schema(
  {
    userId: USER_REF,

    // Cleared when the image expires or is removed while keeping the scan document
    storageKey: { type: String, default: null },
    imagePurgedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
      required: true,
    },
    scannedAt: { type: Date, default: () => new Date() },

    items: {
      type: [
        new Schema(
          {
            itemId: { type: Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
            foodName: { type: String, required: true, maxlength: 150 },
            serving: { type: String, default: null, maxlength: 60 },
            estimatedGrams: { type: Number, default: null },
            per100g: {
              type: new Schema(
                {
                  caloriesKcal: { type: Number, default: null },
                  proteinG: { type: Number, default: null },
                  carbsG: { type: Number, default: null },
                  fatG: { type: Number, default: null },
                },
                { _id: false },
              ),
              default: null,
            },
            caloriesKcal: { type: Number, default: null },
            proteinG: { type: Number, default: null },
            carbsG: { type: Number, default: null },
            fatG: { type: Number, default: null },
            confidence: { type: Number, min: 0, max: 1, default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { versionKey: false, collection: 'food_scans' },
);

// Indexes are created by migrations 001, 003, not declared here

const LIST_FIELDS = 'storageKey status scannedAt items';

foodScanSchema.statics.createProcessing = async function createProcessing(userId, storageKey, client) {
  const [doc] = await this.create([{ userId, storageKey, status: 'processing' }], opts(client));
  return withId(doc.toObject());
};

foodScanSchema.statics.complete = async function complete(id, items, client) {
  const doc = await this.findByIdAndUpdate(
    id,
    { $set: { status: 'completed', items } },
    { new: true, runValidators: true, ...opts(client) },
  ).lean();
  return withId(doc);
};

foodScanSchema.statics.clearImage = async function clearImage(id, storageKey, client) {
  await this.updateOne({ _id: id, storageKey }, { $set: { storageKey: null, imagePurgedAt: new Date() } }, opts(client));
};

foodScanSchema.statics.fail = async function fail(id, client) {
  await this.updateOne({ _id: id }, { $set: { status: 'failed' } }, opts(client));
};

foodScanSchema.statics.getOwned = async function getOwned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  return withId(await this.findOne({ _id: id, userId }, LIST_FIELDS, opts(client)).lean());
};

/** Deletes an owned scan and returns it (including storageKey for file cleanup). */
foodScanSchema.statics.removeOwned = async function removeOwned(id, userId, client) {
  if (!mongoose.isValidObjectId(id)) return null;
  return withId(await this.findOneAndDelete({ _id: id, userId }, opts(client)).lean());
};

// Cursor-paginated completed scans, newest first (`before` is the last seen scannedAt)
foodScanSchema.statics.listPage = async function listPage(userId, { before = null, limit = 10 } = {}, client) {
  const filter = { userId, status: 'completed' };
  if (before) filter.scannedAt = { $lt: before };
  const rows = await this.find(filter, LIST_FIELDS, opts(client))
    .sort({ scannedAt: -1 })
    .limit(limit)
    .lean();
  return rows.map(withId);
};

/** Clears storageKey on scans older than `retentionDays` and returns the affected rows. */
foodScanSchema.statics.purgeExpiredImages = async function purgeExpiredImages(retentionDays, batch = 200, client) {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const rows = await this.find(
    { storageKey: { $type: 'string' }, scannedAt: { $lt: cutoff } },
    'userId storageKey',
    opts(client),
  )
    .limit(batch)
    .lean();
  if (!rows.length) return [];

  // storageKey in the filter too, so a scan purged concurrently isn't counted twice
  await this.updateMany(
    { _id: { $in: rows.map((r) => r._id) }, storageKey: { $type: 'string' } },
    { $set: { storageKey: null, imagePurgedAt: new Date() } },
    opts(client),
  );
  return rows.map(withId);
};

module.exports = mongoose.model('FoodScan', foodScanSchema);