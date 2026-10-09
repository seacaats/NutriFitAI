import { useAuth } from "@/shared/context/AuthContext";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { onNotificationTap, registerDevice } from "../push";

// Mounted once in the root layout. After sign-in (and on every launch while
// signed in) re-registers this device if permission was already given; it
// never prompts here, Settings does. Users only: nothing an admin gets is
// pushed. A tapped notification opens its link
export function usePushSetup() {
  const { isAuthenticated, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && role === "user") registerDevice({ prompt: false });
  }, [isAuthenticated, role]);

  useEffect(() => onNotificationTap((link) => router.push(link)), [router]);
}