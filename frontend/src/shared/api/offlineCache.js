import AsyncStorage from "@react-native-async-storage/async-storage";

// Last good response of each signed-in GET, kept on the device (AsyncStorage;
// localStorage on web) so screens still show something when the server
// can't be reached. Wiped on sign-out

// Bump when a response shape changes, so old entries are simply ignored
const PREFIX = "nf-cache:v1:";
// Big lists aren't worth the storage (Android ~6MB, browsers ~5MB)
const MAX_ENTRY_CHARS = 200_000;
// Admin data and downloads stay online-only
const SKIP = [/^\/admin\b/, /^\/superadmin\b/, /^\/auth\/(?!me$)/];

export const isCacheable = (path) => !SKIP.some((re) => re.test(path));

export async function saveCached(path, data) {
  if (!isCacheable(path)) return;
  try {
    const value = JSON.stringify({ savedAt: Date.now(), data });
    if (value.length > MAX_ENTRY_CHARS) return;
    await AsyncStorage.setItem(PREFIX + path, value);
  } catch {
    // Storage full or unavailable: caching is best-effort
  }
}

// { savedAt, data } or null
export async function readCached(path) {
  if (!isCacheable(path)) return null;
  try {
    const raw = await AsyncStorage.getItem(PREFIX + path);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// On sign-out, or when a different account signs in on this phone
export async function clearCached() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // Nothing to clear
  }
}