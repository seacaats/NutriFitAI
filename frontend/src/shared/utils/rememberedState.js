import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * User-scoped state cache for UI persistence (e.g. active tab, active conversation).
 * Values expire after maxAgeMs and are cleared on user sign-out.
 */

const PREFIX = "nutrifit.remembered:";

const keyFor = (name, userId) => `${PREFIX}${name}:${userId}`;

// Returns cached value or null if expired or missing
export function getRemembered(name, userId, maxAgeMs) {
  if (!userId) return null;
  return AsyncStorage.getItem(keyFor(name, userId))
    .then((raw) => {
      if (!raw) return null;
      const { value, savedAt } = JSON.parse(raw);
      return Date.now() - savedAt <= maxAgeMs ? value : null;
    })
    .catch(() => null);
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

// Legacy storage keys to remove on clear
const LEGACY_KEYS = ["nutrifit:workouts-tab", "nutrifit.coach.lastConversationId"];

export async function clearRemembered() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX) || LEGACY_KEYS.includes(k));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // Nothing to clear
  }
}
