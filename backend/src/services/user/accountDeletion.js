const { withTransaction } = require('../../../config/mongo');
const User = require('../../models/user/User');
const WeightLog = require('../../models/user/WeightLog');
const AuthChallenge = require('../../models/auth/AuthChallenge');
const Session = require('../../models/auth/Session');
const AuthIdentity = require('../../models/auth/AuthIdentity');
const WaterLog = require('../../models/water/WaterLog');
const FoodScan = require('../../models/food/FoodScan');
const Meal = require('../../models/food/Meal');
const ChatConversation = require('../../models/chat/ChatConversation');
const ChatMessage = require('../../models/chat/ChatMessage');
const DailySteps = require('../../models/steps/DailySteps');
const Workout = require('../../models/workouts/Workout');
const FavoriteWorkout = require('../../models/workouts/FavoriteWorkout');
const WorkoutSession = require('../../models/workouts/WorkoutSession');
const WorkoutRoutine = require('../../models/workouts/WorkoutRoutine');
const Notification = require('../../models/notifications/Notification');
const PushToken = require('../../models/notifications/PushToken');
const ImageReview = require('../../models/moderation/ImageReview');
const storage = require('../../utils/storage/index');
const { clearStoredAvatar } = require('../../utils/storage/avatarStore');
const { logSystemAction } = require('../../utils/audit-logs/auditLogger');
const { notify } = require('../../services/notifications/notify');

const DELETION_GRACE_DAYS = 14;

// Collections keyed by userId (audit collections are preserved across deletions)
const BY_USER_ID = {
  weightLogs: WeightLog,
  authChallenges: AuthChallenge,
  authSessions: Session,
  authIdentities: AuthIdentity,
  waterLogs: WaterLog,
  foodScans: FoodScan,
  meals: Meal,
  dailySteps: DailySteps,
  favoriteWorkouts: FavoriteWorkout,
  workoutSessions: WorkoutSession,
  notifications: Notification,
  pushTokens: PushToken,
  imageReviews: ImageReview,
};

const ADMIN_BY_USER_ID = {
  authChallenges: AuthChallenge,
  authSessions: Session,
  authIdentities: AuthIdentity,
  notifications: Notification,
  pushTokens: PushToken,
};

// Deletes the user account and owned documents in one transaction, then purges stored files
async function deleteAccount(userId, role = 'user') {
  const isUser = role === 'user';

  const counts = await withTransaction(async (client) => {
    const session = { session: client };
    const result = {};

    if (isUser) {
      const conversations = await ChatConversation.find({ userId }, { _id: 1 }, session).lean();
      const conversationIds = conversations.map((c) => c._id);
      result.chatMessages = (await ChatMessage.deleteMany({ conversationId: { $in: conversationIds } }, session)).deletedCount;
      result.chatConversations = (await ChatConversation.deleteMany({ userId }, session)).deletedCount;
    }

    for (const [name, Model] of Object.entries(isUser ? BY_USER_ID : ADMIN_BY_USER_ID)) {
      result[name] = (await Model.deleteMany({ userId }, session)).deletedCount;
    }

    if (isUser) {
      result.workoutRoutines = (await WorkoutRoutine.deleteMany({ ownerId: userId }, session)).deletedCount;
      result.workouts = (await Workout.deleteMany({ createdBy: userId }, session)).deletedCount;
    }

    result.users = (await User.deleteOne({ _id: userId }, session)).deletedCount;
    return result;
  });

  await clearStoredAvatar(userId);
  if (isUser) {
    await storage.removePrefix(storage.keys.userScanPrefix(userId));
    await storage.removePrefix(storage.keys.userWorkoutPrefix(userId));
  }

  return counts;
}

// Purges accounts whose deletion grace period has expired
async function purgeDueDeletions() {
  try {
    for (const target of await User.listDueForDeletion()) {
      try {
        const deletedCounts = await deleteAccount(target.id, target.role || 'user');
        await logSystemAction({
          action: 'admin.user.deleted',
          targetType: 'user',
          targetId: target.id,
          targetLabel: target.fullName || target.email,
          targetRole: target.role || 'user',
          details: { deletedCounts, reason: 'Deletion grace period ended' },
        });
        notify(null, 'account_deleted', { email: target.email });
      } catch (err) {
        console.error('[purge] account deletion failed', target.id, err);
      }
    }
  } catch (err) {
    console.error('[purge] due deletions lookup failed', err);
  }
}

module.exports = { deleteAccount, purgeDueDeletions, DELETION_GRACE_DAYS };
