const crypto = require('crypto');
const { mongoose } = require('../../../config/mongo');

const { Schema } = mongoose;

// users -- absorbs user_profiles (1:1) and user_goals (bounded history).



// Dates are plain validated strings instead Date objects
// to avoid timezone-shift bugs, or simply any inconsistent
// read/write/delivery of timezones for users
const CALENDAR_DAY = {
  type: String,
  validate: {
    validator: (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
    message: (p) => `${p.path} must be a YYYY-MM-DD string, received "${p.value}"`,
  },
};

const profileSchema = new Schema(
  {
    age: { type: Number, min: 0, max: 130 },
    ageRecordedOn: CALENDAR_DAY,
    gender: { type: String, maxlength: 20 },
    heightCm: { type: Number, min: 0, max: 300 },
    activityLevel: { type: String, maxlength: 30 },
    dietPreference: { type: String, maxlength: 30 },
    healthConditions: { type: String, default: null },

    theme: { type: String, enum: ['system', 'light', 'dark'], default: 'system' },
    notificationsEnabled: { type: Boolean, default: true },
    timezone: { type: String, maxlength: 50 },

    // Storage key rather than a URL
    avatarStorageKey: { type: String, default: null },

    // No external-integration structure and three simple fields
    // since no token or external account ID are needed, unlike Google OAuth
    stepSource: {
      type: String,
      enum: ['healthkit', 'health_connect', 'device_sensor', null],
      default: null,
    },
    stepPermissionAt: { type: Date, default: null },
    lastStepSyncAt: { type: Date, default: null },
  },
  { _id: false },
);


// A user changes their goal only a handful of times, taking into 
// consideration the 16MB document ceiling for embeedded documents
const goalSchema = new Schema(
  {
    fitnessGoal: { type: String, maxlength: 30, default: null },
    dailyCaloriesKcal: { type: Number, default: null },
    dailyProteinG: { type: Number, default: null },
    dailyCarbsG: { type: Number, default: null },
    dailyFatG: { type: Number, default: null },
    dailyWaterMl: { type: Number, default: null },
    dailySteps: { type: Number, default: null },
    weeklyWorkouts: { type: Number, default: null },

    // Calendar details are supplied by the client
    effectiveFrom: { ...CALENDAR_DAY, required: true },
    effectiveUntil: { ...CALENDAR_DAY, default: null },
  },
  { _id: false },
);

const userSchema = new Schema(
  {

    // UUID, not Mongo's ObjectId. Three things that depend on it:
    //    * issued JWTs carry it as "sub" or subject
    //    * avatar filenames on disk
    //    * frontend route params and authStorage circles it as a string
    _id: { type: String, default: () => crypto.randomUUID() },

    email: { type: String, required: true, maxlength: 255 },
    passwordHash: { type: String, default: null }, // null for OAuth-only accounts
    fullName: { type: String, maxlength: 150, default: null },
    firstName: { type: String, maxlength: 75, default: null },
    lastName: { type: String, maxlength: 75, default: null },

    // Order is load bearing, used by callers. Should be kept as is
    // Closed enum rather than a string since they carry signed tokens
    // Sync with authMiddleware.js, and Authcontext.js in the frontend
    role: {
      type: String,
      enum: ['user', 'admin', 'superadmin'],
      default: 'user',
      required: true,
    },

    emailVerifiedAt: { type: Date, default: null },
    termsAcceptedAt: { type: Date, default: null },
    createdAt: { type: Date, default: () => new Date() },

    profile: { type: profileSchema, default: () => ({}) },
    goals: { type: [goalSchema], default: [] },
  },
  { versionKey: false, collection: 'users' },
);

// Unique index is case-sensitive, so always use .toLowerCase for emails. 
// An email to Andro@x.com and andro@x.com goes to the same inbox anyway
userSchema.index({ email: 1 }, { unique: true, name: 'users_email_unique' });


// Ran by script for migrating admin roles as changing a
// partialFilterExpression rejects them as IndexOptionsConflict
const PRIVILEGED_ROLES = ['admin', 'superadmin'];
userSchema.index(
  { role: 1 },
  {
    // Named explicity to prevent Mongo from generating one
    name: 'users_role_privileged',
    partialFilterExpression: { role: { $in: PRIVILEGED_ROLES } },
  },
);

// User management table, newest first 
userSchema.index({ createdAt: -1 }, { name: 'users_recent' });

module.exports = {
  User: mongoose.model('User', userSchema),
  PRIVILEGED_ROLES,
  CALENDAR_DAY,
};