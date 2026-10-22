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
const storage = require('../../utils/storage/index');
const { clearStoredAvatar } = require('../../utils/storage/avatarStore');
const { logSystemAction } = require('../../utils/audit-logs/auditLogger');
const { notify } = require('../../services/notifications/notify');

// How long a deleted account waits before the purge. Keep in sync with the notice in notify.js
const DELETION_GRACE_DAYS = 14;

// Collections keyed by userId. A new userId collection must be added here,
// or deleting an account leaves its rows behind (see the notes at the end of migration 001).
// audit_logs, audit_notes and audit_holds are deliberately never touched, for any role
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
};

// Admins only reach /profile, /notifications and /admin, so they
// own nothing beyond these. Their trail stays, under the names saved on it
const ADMIN_BY_USER_ID = {
  authChallenges: AuthChallenge,
  authSessions: Session,
  authIdentities: AuthIdentity,
  notifications: Notification,
  pushTokens: PushToken,
};

// Deletes the account and everything it owns in one transaction, then its
// files. Returns per-collection counts for the audit entry. Files go after
// the commit, so a rollback never leaves a record pointing at a missing file.
// Regular users also lose their app data, admins only what is listed above
async function deleteAccount(userId, role = 'user') {
  const isUser = role === 'user';

  const counts = await withTransaction(async (client) => {
    const session = { session: client };
    const result = {};

    if (isUser) {
      // Messages hang off conversations, not the user
      const conversations = await ChatConversation.find({ userId }, { _id: 1 }, session).lean();
      const conversationIds = conversations.map((c) => c._id);
      result.chatMessages = (await ChatMessage.deleteMany({ conversationId: { $in: conversationIds } }, session)).deletedCount;
      result.chatConversations = (await ChatConversation.deleteMany({ userId }, session)).deletedCount;
    }

    for (const [name, Model] of Object.entries(isUser ? BY_USER_ID : ADMIN_BY_USER_ID)) {
      result[name] = (await Model.deleteMany({ userId }, session)).deletedCount;
    }

    if (isUser) {
      // Routines use ownerId. Shared routines (ownerId null) are untouched
      result.workoutRoutines = (await WorkoutRoutine.deleteMany({ ownerId: userId }, session)).deletedCount;
      // Their own catalog workouts, wger's are untouched
      result.workouts = (await Workout.deleteMany({ createdBy: userId }, session)).deletedCount;
    }

    result.users = (await User.deleteOne({ _id: userId }, session)).deletedCount;
    return result;
  });

  // Neither throws, see localStore
  await clearStoredAvatar(userId);
  if (isUser) {
    await storage.removePrefix(storage.keys.userScanPrefix(userId));
    await storage.removePrefix(storage.keys.userWorkoutPrefix(userId));
  }

  return counts;
}

// Deletes accounts whose grace period has ended. Run by the scheduler in server.js,
// never throws: a failure is picked up again on the next run
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