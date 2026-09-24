const { mongoose } = require('../../../config/mongo');
const env = require('../../../config/env');
const { User, CALENDAR_DAY } = require('./userSchema');

const { Schema } = mongoose;


// userId is plain string - users._id is a UUID string
const USER_REF = { type: String, required: true, ref: 'User' };

// ===========================================================================
// AUTH
// ===========================================================================

// Separate collection to keep a copmpound unique index across two top-level fields,
// which makes any duplicate-key errors and other similar issues be interpretable
const authIdentitySchema = new Schema(
  {
    userId: USER_REF,
    provider: { type: String, enum: ['google', 'facebook'], required: true },
    providerSubject: { type: String, required: true, maxlength: 255 },
  },
  { versionKey: false, collection: 'auth_identities' },
);

// Replaces auth_identities_provider_provider_subject_key. This is what makes
// AuthIdentity.link()'s upsert behave like ON CONFLICT DO NOTHING
authIdentitySchema.index(
  { provider: 1, providerSubject: 1 },
  { unique: true, name: 'auth_identities_provider_subject_unique' },
);
authIdentitySchema.index({ userId: 1 }, { name: 'auth_identities_user' });

const authChallengeSchema = new Schema(
  {
    userId: USER_REF,
    purpose: { type: String, enum: ['email_verification', 'password_reset'], required: true },
    codeHash: { type: String, required: true }, // hash of the OTP, never plaintext
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    failedAttempts: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'auth_challenges' },
);

authChallengeSchema.index(
  { userId: 1, purpose: 1, createdAt: -1 },
  { name: 'auth_challenges_user_purpose_recent' },
);

//OTP challenges for email verification and password reset.
//The collection carries a TTL index on expiresAt (expireAfterSeconds: 0), so
//expired challenges delete themselves. Note that TTL monitors run every 60 seconds
authChallengeSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, name: 'auth_challenges_ttl' },
);

// ===========================================================================
// HEALTH / ACTIVITY
// ===========================================================================

const dailyStepsSchema = new Schema(
  {
    userId: USER_REF,

    // String, not date (see userSchema.js)
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


// Index for enforcing: "only one record per user per day"
dailyStepsSchema.index(
  { userId: 1, activityDate: 1 },
  { unique: true, name: 'daily_steps_user_date_unique' },
);

const weightLogSchema = new Schema(
  {
    userId: USER_REF,
    weightKg: { type: Number, required: true, min: 0, max: 700 },
    measuredAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'weight_logs' },
);
weightLogSchema.index({ userId: 1, measuredAt: -1 }, { name: 'weight_logs_user_recent' });

const waterLogSchema = new Schema(
  {
    userId: USER_REF,
    amountMl: { type: Number, required: true, min: 0 },
    loggedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'water_logs' },
);
waterLogSchema.index({ userId: 1, loggedAt: -1 }, { name: 'water_logs_user_recent' });

// ===========================================================================
// NUTRITION
// ===========================================================================


// Nutritional logs are copied from a scan to the 
// meal record since scans have a TTL index
const mealItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
    scanRef: {
      type: new Schema(
        {
          scanId: { type: Schema.Types.ObjectId, required: true },
          itemId: { type: Schema.Types.ObjectId, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    foodName: { type: String, required: true, maxlength: 150 },
    portionGrams: { type: Number, default: null },
    caloriesKcal: { type: Number, default: null },
    proteinG: { type: Number, default: null },
    carbsG: { type: Number, default: null },
    fatG: { type: Number, default: null },
  },
  { _id: false },
);

const mealSchema = new Schema(
  {
    userId: USER_REF,
    mealType: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
    status: {
      type: String,
      enum: ['planned', 'consumed', 'skipped'],
      default: 'planned',
      required: true,
    },
    plannedFor: { type: Date, default: null },
    consumedAt: { type: Date, default: null },

    // A meal can either have one or a handful items, always read and
    // written with their meal, and queried all the same
    items: { type: [mealItemSchema], default: [] },
  },
  { versionKey: false, collection: 'meals' },
);
mealSchema.index({ userId: 1, plannedFor: 1 }, { name: 'meals_user_planned' });


// food_scans -- model not integrated yet
const foodScanSchema = new Schema(
  {
    userId: USER_REF,

    // Storage key, not a URL -- same reasoning as profile.avatarStorageKey
    // Goes null on purge while the document itself survives
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
            estimatedGrams: { type: Number, default: null },
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
foodScanSchema.index({ userId: 1, scannedAt: -1 }, { name: 'food_scans_user_recent' });

// ===========================================================================
// WORKOUTS
// ===========================================================================

const workoutRoutineSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 150 },
    description: { type: String, default: null },
    trainingType: { type: String, enum: ['strength', 'cardio', 'flexibility', 'endurance'] },
    difficulty: { type: String, maxlength: 20 },
    estimatedDurationMinutes: { type: Number, default: null },

    exercises: {
      type: [
        new Schema(
          {
            exerciseRef: { type: Number, required: true }, // wger id = workouts._id
            // Denormalised cache. It avoids a $lookup on every
            // routine render, the same way it avoided a cross-database call
            // in the hybrid design
            exerciseName: { type: String, required: true, maxlength: 150 },
            position: { type: Number, required: true },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { versionKey: false, collection: 'workout_routines' },
);

const workoutSessionSchema = new Schema(
  {
    userId: USER_REF,

    // A session is either a single exercise or based on pre-built routine
    // This discriminator key (NOT Mongoose) is used then as an explicit field
    // of inferring the session rather than basing on what was empty and what wasn't
    kind: { type: String, enum: ['routine', 'exercise'], required: true },

    routineId: { type: Schema.Types.ObjectId, ref: 'WorkoutRoutine', default: null },
    exerciseRef: { type: Number, default: null },
    exerciseName: { type: String, maxlength: 150, default: null },

    targetSets: { type: Number, default: null },
    targetReps: { type: Number, default: null },
    completedSets: { type: Number, default: 0, min: 0 },

    scheduledFor: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ['planned', 'active', 'completed', 'skipped'],
      default: 'planned',
      required: true,
    },
    actualDurationSeconds: { type: Number, default: null },
    caloriesBurnedKcal: { type: Number, default: null },
  },
  { versionKey: false, collection: 'workout_sessions' },
);


// Enforces having the session kind as explained above:
// "must have either routine or an exercise, not both/neither"
// which findOneAndUpdate deliberately skips
workoutSessionSchema.pre('validate', function enforceSessionKind() {
  if (this.kind === 'routine') {
    if (!this.routineId) throw new Error('kind "routine" requires routineId');
    if (this.exerciseRef != null) throw new Error('kind "routine" must not set exerciseRef');
  } else if (this.kind === 'exercise') {
    if (this.exerciseRef == null) throw new Error('kind "exercise" requires exerciseRef');
    if (this.routineId) throw new Error('kind "exercise" must not set routineId');
  }
});

workoutSessionSchema.index(
  { userId: 1, scheduledFor: -1 },
  { name: 'workout_sessions_user_scheduled' },
);

// Separate index to filter sessions by completion time rather 
// than scheduled time. The latter to be implemented on routines 
workoutSessionSchema.index(
  { userId: 1, completedAt: -1 },
  { name: 'workout_sessions_user_completed' },
);

// Index filtered sessions using the discriminator key above (kind) 
workoutSessionSchema.index(
  { exerciseRef: 1 },
  { partialFilterExpression: { kind: 'exercise' }, name: 'workout_sessions_exercise_ref' },
);

// ===========================================================================
// WGER CATALOG
// ===========================================================================

// _id is wger's own numeric exercise id, not ObjectId to maintain consistency
// with frontend code and other collections which already use it 
const workoutSchema = new Schema(
  {
    _id: { type: Number }, // wger exercise id
    name: { type: String, required: true },
    description: { type: String, default: null },
    category: { id: Number, name: String },

    // Only language 2 (English) is stored
    translations: { type: Array, default: [] },

    muscles: { type: Array, default: [] },
    musclesSecondary: { type: Array, default: [] },
    equipment: { type: Array, default: [] },

    // Pre-normalised by the sync job, only URLs are stored
    images: { type: [String], default: [] },

    // Precomputed so GET /api/workouts can filter server-side
    hasRealImage: { type: Boolean, default: false },

    syncedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'workouts', _id: false },
);

workoutSchema.index({ 'category.id': 1 }, { name: 'workouts_category' });
workoutSchema.index({ hasRealImage: 1 }, { name: 'workouts_has_image' });

// MongoDB built-in text index for searching workouts
workoutSchema.index(
  { name: 'text', 'muscles.name': 'text', 'category.name': 'text' },
  { name: 'workouts_text', weights: { name: 10, 'muscles.name': 5, 'category.name': 1 } },
);

const workoutCategorySchema = new Schema(
  {
    _id: { type: Number }, // wger category id
    name: { type: String, required: true },
    syncedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'workout_categories', _id: false },
);

// ===========================================================================
// CHAT
// ===========================================================================

const chatConversationSchema = new Schema(
  {
    userId: USER_REF,
    title: { type: String, maxlength: 150, default: null },

    // Says which UI opened the conversation. Food scan to be integrated
    surface: { type: String, enum: ['coach', 'food_scan'], default: 'coach', required: true },

    scanRef: {
      type: new Schema({ scanId: { type: Schema.Types.ObjectId, required: true } }, { _id: false }),
      default: null,
    },

    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'chat_conversations' },
);
chatConversationSchema.index(
  { userId: 1, surface: 1, updatedAt: -1 },
  { name: 'chat_conversations_user_surface_recent' },
);

// Index for tracking conversation tied to a food scan
chatConversationSchema.index(
  { 'scanRef.scanId': 1 },
  {
    partialFilterExpression: { 'scanRef.scanId': { $exists: true } },
    name: 'chat_conversations_scan_ref',
  }
);

const chatMessageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatConversation',
      required: true,
    },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    provider: { type: String, maxlength: 30, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'chat_messages' },
);

chatMessageSchema.index(
  { conversationId: 1, createdAt: 1 },
  { name: 'chat_messages_conversation_order' },
);


// 180 (Temporary) TTL on messages. contextBuilder only bases 
// on the last 10 turns anyway
chatMessageSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: env.mongo.chatMessageTtlSeconds,
    // Hardcoded index name, value is configurable still but just kept as is
    name: 'chat_messages_ttl_180d',
  },
);

// ===========================================================================
// AUDIT
// ===========================================================================

// Outlives the document it tracks, No TTL
const auditLogSchema = new Schema(
  {
    // Nullable, different from what other parts of the code use (USER_REF),
    // so system actions and failed logins not tied to a specific user can be logged
    userId: { type: String, ref: 'User', default: null },

    // Snapshot of the actor's role at the time of action to avoid
    // inconsistencies if ever their roles change
    role: { type: String, maxlength: 30, default: null },

    // Snapshot of the actor's display name at the time
    // Same reasoning with role, changes in name may even lead to
    // data corruption
    actorLabel: { type: String, maxlength: 150, default: null },
    targetLabel: { type: String, maxlength: 150, default: null },

    // The subject's role at the time, beside the actor's
    // Nullable for self-directed actions or non-account targets
    targetRole: { type: String, maxlength: 30, default: null },


    // The action done. Naming convention: "auth.login.succeeded",
    // "admin.user.role_change", for filtering purposes. Actual permitted
    // values, along with their severity, and other details are in auditActions.js
    // Kept as a string rather than an enum to make any new tracked actions remain valid
    action: { type: String, required: true, maxlength: 100 },


    // Records what/who an action was directed to. Assumes a
    // self-directed action for blank entries
    targetType: { type: String, maxlength: 50, default: null },
    targetId: { type: String, default: null },


    details: { type: Schema.Types.Mixed, default: null },

    ipAddress: { type: String, maxlength: 64, default: null },
    userAgent: { type: String, maxlength: 300, default: null },

    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false, collection: 'audit_logs' },
);


// Index for serving a user's activity history
auditLogSchema.index({ userId: 1, createdAt: -1 }, { name: 'audit_logs_user_recent' });
// Index for serving every instance of an action across all users
auditLogSchema.index({ action: 1, createdAt: -1 }, { name: 'audit_logs_action_recent' });


// Index for serving all recent logged actions
auditLogSchema.index({ createdAt: -1 }, { name: 'audit_logs_recent' });


// Index for serving recently logged actions per role
auditLogSchema.index(
  { targetType: 1, createdAt: -1 },
  { name: 'audit_logs_target_type_recent' },
);
// Index for serving recently logged actions to a user
auditLogSchema.index({ targetId: 1, createdAt: -1 }, { name: 'audit_logs_target_recent' });

// ===========================================================================

module.exports = {
  User,
  AuditLogDoc: mongoose.model('AuditLog', auditLogSchema),
  AuthIdentity: mongoose.model('AuthIdentity', authIdentitySchema),
  AuthChallenge: mongoose.model('AuthChallenge', authChallengeSchema),
  DailyStepsDoc: mongoose.model('DailySteps', dailyStepsSchema),
  WeightLogDoc: mongoose.model('WeightLog', weightLogSchema),
  WaterLogDoc: mongoose.model('WaterLog', waterLogSchema),
  Meal: mongoose.model('Meal', mealSchema),
  FoodScan: mongoose.model('FoodScan', foodScanSchema),
  WorkoutRoutine: mongoose.model('WorkoutRoutine', workoutRoutineSchema),
  WorkoutSession: mongoose.model('WorkoutSession', workoutSessionSchema),
  Workout: mongoose.model('Workout', workoutSchema),
  WorkoutCategory: mongoose.model('WorkoutCategory', workoutCategorySchema),
  ChatConversationDoc: mongoose.model('ChatConversation', chatConversationSchema),
  ChatMessageDoc: mongoose.model('ChatMessage', chatMessageSchema),
};