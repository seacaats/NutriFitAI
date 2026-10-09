const { withTransaction } = require('../../config/mongo');
const User = require('../models/user/User');
const WeightLog = require('../models/user/WeightLog');
const AuthChallenge = require('../models/auth/AuthChallenge');
const AuthIdentity = require('../models/auth/AuthIdentity');
const WaterLog = require('../models/water/WaterLog');
const FoodScan = require('../models/food/FoodScan');
const Meal = require('../models/food/Meal');
const ChatConversation = require('../models/chat/ChatConversation');
const ChatMessage = require('../models/chat/ChatMessage');
const DailySteps = require('../models/steps/DailySteps');
const FavoriteWorkout = require('../models/workouts/FavoriteWorkout');
const WorkoutSession = require('../models/workouts/WorkoutSession');
const WorkoutRoutine = require('../models/workouts/WorkoutRoutine');
const Notification = require('../models/notifications/Notification');
const PushToken = require('../models/notifications/PushToken');
const storage = require('../utils/storage');
const { clearStoredAvatar } = require('../utils/storage/avatarStore');

// Collections keyed by userId. A new userId collection must be added here,
// or deleting an account leaves its rows behind (see the notes at the end of migration 001).
// audit_logs is deliberately not one of them
const BY_USER_ID = {
  weightLogs: WeightLog,
  authChallenges: AuthChallenge,
  authIdentities: AuthIdentity,
  waterLogs: WaterLog,
  foodScans: FoodScan,
  meals: Meal,
  dailySteps: DailySteps,
  favoriteWorkouts: FavoriteWorkout,
  workoutSessions: WorkoutSession,
  notifications: Notification,
  pushTokens: PushToken,
};

// Deletes the account and everything it owns in one transaction, then its
// files. Returns per-collection counts for the audit entry. Files go after
// the commit, so a rollback never leaves a record pointing at a missing file
async function deleteUserAccount(userId) {
  const counts = await withTransaction(async (client) => {
    const session = { session: client };
    const result = {};

    // Messages hang off conversations, not the user
    const conversations = await ChatConversation.find({ userId }, { _id: 1 }, session).lean();
    const conversationIds = conversations.map((c) => c._id);
    result.chatMessages = (await ChatMessage.deleteMany({ conversationId: { $in: conversationIds } }, session)).deletedCount;
    result.chatConversations = (await ChatConversation.deleteMany({ userId }, session)).deletedCount;

    for (const [name, Model] of Object.entries(BY_USER_ID)) {
      result[name] = (await Model.deleteMany({ userId }, session)).deletedCount;
    }
    // Routines use ownerId. Shared routines (ownerId null) are untouched
    result.workoutRoutines = (await WorkoutRoutine.deleteMany({ ownerId: userId }, session)).deletedCount;

    result.users = (await User.deleteOne({ _id: userId }, session)).deletedCount;
    return result;
  });

  // Neither throws, see localStore
  await clearStoredAvatar(userId);
  await storage.removePrefix(storage.keys.userScanPrefix(userId));

  return counts;
}

module.exports = { deleteUserAccount };