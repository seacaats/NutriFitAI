const User = require('../../models/user/User');
const FoodScan = require('../../models/food/FoodScan');
const Workout = require('../../models/workouts/Workout');
const storage = require('../../utils/storage');
const { clearStoredAvatar } = require('../../utils/storage/avatarStore');

// Template variables for photo_removed_* notifications
const PHOTO_NOTICE = {
  avatar: { photo: 'profile photo', link: '/profile', kept: '' },
  scan: { photo: 'food scan photo', link: '/food-scanner', kept: ' Your scan results are still saved.' },
  workout: { photo: 'exercise photo', link: '/workouts', kept: ' The exercise itself is still saved.' },
};
const photoNoticeVars = (kind) => PHOTO_NOTICE[kind] || { photo: 'photo', link: '/profile', kept: '' };

// Deletes a moderated photo and clears any active reference still pointing to that storageKey
async function removePhoto({ kind, storageKey, refId, userId }) {
  if (!storageKey) return;
  if (kind === 'avatar') {
    const user = await User.getById(userId);
    if (user?.profile?.avatarStorageKey === storageKey) {
      await User.updateProfile(userId, { avatarStorageKey: null });
      await clearStoredAvatar(userId);
      return;
    }
  } else if (kind === 'scan') {
    await FoodScan.clearImage(refId, storageKey);
  } else if (kind === 'workout') {
    await Workout.updateOne({ _id: refId, imageKey: storageKey }, { $set: { imageKey: null, hasRealImage: false } });
  }
  await storage.remove(storageKey);
}

module.exports = { removePhoto, photoNoticeVars };
