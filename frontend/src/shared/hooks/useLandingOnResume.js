import { AUTH_STATUS, useAuth } from "@/shared/context/AuthContext";
import { isGoogleSignInOpen } from "@/shared/services/googleAuth";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

// Screens a signed-out user leaves the app from on purpose: the emailed codes
// and the Google callback. Coming back to these keeps them where they were
const MID_FLOW = ["/verify-registration", "/verify-reset-password", "/reset-password", "/google-auth"];

// Forms with something typed in. Coming back keeps them too, rather than
// throwing the input away
const filledForms = new Set();

// For a form hook: holds the reset while `hasInput` is true
export function useKeepOnResume(hasInput) {
  useEffect(() => {
    if (!hasInput) return undefined;
    const token = {};
    filledForms.add(token);
    return () => filledForms.delete(token);
  }, [hasInput]);
}

// Phone only: a signed-out user coming back from the background starts over
// on the landing page (which resets itself to its first slide)
export function useLandingOnResume() {
  const router = useRouter();
  const pathname = usePathname();
  const { status, isAuthenticated } = useAuth();
  const latest = useRef({});
  latest.current = { pathname, status, isAuthenticated };
  const previous = useRef(AppState.currentState);

  useEffect(() => {
    if (Platform.OS === "web") return undefined;
    const sub = AppState.addEventListener("change", (next) => {
      // Only a real trip to the background; iOS goes "inactive" for the
      // notification shade too
      const resumed = previous.current === "background" && next === "active";
      previous.current = next;
      if (!resumed) return;

      const { pathname: path, status: s, isAuthenticated: signedIn } = latest.current;
      if (s === AUTH_STATUS.LOADING || signedIn) return;
      if (MID_FLOW.includes(path) || filledForms.size || isGoogleSignInOpen()) return;
      if (path !== "/") router.dismissTo("/");
    });
    return () => sub.remove();
  }, [router]);
}
