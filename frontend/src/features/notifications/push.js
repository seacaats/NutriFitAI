import { apiClient } from "@/shared/api/apiClient";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Native push: permission, the Expo token, and tap handling. push.web.js
// is the web stand-in (no push on web; the inbox and email still work)

// The token this device registered with, kept so sign-out can remove it.
// Re-learned on every launch by registerDevice
let currentToken = null;

// Shown while the app is open too, not only in the background
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Gets this device's Expo token and sends it to the server.
 * `prompt: false` (on launch) only registers when permission was already
 * given; `prompt: true` (from Settings) asks first. Never throws.
 * Returns "granted" | "denied" | "unavailable"
 */
export async function registerDevice({ prompt = false } = {}) {
  try {
    // Simulators and emulators can't receive push
    if (!Device.isDevice) return "unavailable";

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "NutriFitAI",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted" && prompt) ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== "granted") return "denied";

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await apiClient.post("/notifications/tokens", { token, platform: Platform.OS }, { auth: true });
    currentToken = token;
    return "granted";
  } catch {
    return "unavailable";
  }
}

// Before sign-out, so the next person on this phone doesn't get this
// account's notifications. Never throws
export async function unregisterDevice() {
  if (!currentToken) return;
  try {
    await apiClient.delete("/notifications/tokens", { auth: true, body: { token: currentToken } });
  } catch {
    // The 60-day cleanup removes it eventually
  }
  currentToken = null;
}

// Opens a tapped notification's link. Returns the unsubscribe function
export function onNotificationTap(open) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const link = response.notification.request.content.data?.link;
    if (typeof link === "string" && link.startsWith("/")) open(link);
  });
  return () => sub.remove();
}