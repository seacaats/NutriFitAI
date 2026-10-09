import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Small "where was I" values kept on the device (AsyncStorage; localStorage
 * on web): the open Workouts tab, the coach thread to resume.
 *
 * Each value is kept per account and stamped with when it was saved, so it
 * never carries over to another account on the same device and goes stale
 * on its own: a value older than `maxAgeMs` reads as nothing. Sign-out
 * clears them all (AuthContext). Best-effort, a storage failure just means
 * the screen opens on its default
 */

const PREFIX = "nutrifit.remembered:";

const keyFor = (name, userId) => `${PREFIX}${name}:${userId}`;

// The saved value, or null when there's none, it's too old, or no user
export async function getRemembered(name, userId, maxAgeMs) {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(keyFor(name, userId));
    if (!raw) return null;
    const { value, savedAt } = JSON.parse(raw);
    return Date.now() - savedAt <= maxAgeMs ? value : null;
  } catch {
    return null;
  }
}

export async function setRemembered(name, userId, value) {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(keyFor(name, userId), JSON.stringify({ value, savedAt: Date.now() }));
  } catch {
    // Storage full or unavailable
  }
}

export async function forgetRemembered(name, userId) {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(keyFor(name, userId));
  } catch {
    // Nothing to remove
  }
}

// On sign-out: every account's values, plus the unscoped keys these replaced
const LEGACY_KEYS = ["nutrifit:workouts-tab", "nutrifit.coach.lastConversationId"];

export async function clearRemembered() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX) || LEGACY_KEYS.includes(k));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // Nothing to clear
  }
}
