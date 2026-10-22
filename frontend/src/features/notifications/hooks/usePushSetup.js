import { apiClient } from "@/shared/api/apiClient";
import { useAuth } from "@/shared/context/AuthContext";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { onNotificationTap, registerDevice } from "../push";

// Mounted once in the root layout. After sign-in (and on every launch while
// signed in) re-registers this device if permission was already given; it
// never prompts here, Settings does. Users only: nothing an admin gets is
// pushed. A tapped notification opens its link and is marked read
export function usePushSetup() {
  const { isAuthenticated, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Mobile only; web has no push
    if (Platform.OS !== "web" && isAuthenticated && role === "user") registerDevice({ prompt: false });
  }, [isAuthenticated, role]);

  // Listens once signed in, so a tap that launched the app is handled with a session
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    return onNotificationTap((link, id) => {
      router.push(link);
      // Same as opening it in the inbox. A failure only leaves it unread
      if (typeof id === "string") apiClient.post("/notifications/read", { ids: [id] }, { auth: true }).catch(() => {});
    });
  }, [isAuthenticated, router]);
}