import { homeFor, useAuth } from "@/shared/context/AuthContext";
import { useLocalSearchParams, useRouter } from "expo-router";

/**
 * Shown when a route guard refuses a navigation. Three variants:
 *  - unauthenticated: no session at all
 *  - unverified:      signed in, email not confirmed
 *  - forbidden:       signed in and verified, but the role isn't permitted
 * `icon` is the mobile Ionicon, `emoji` the web one
 */
const VARIANTS = {
  unauthenticated: {
    icon: "lock-closed",
    emoji: "🔒",
    title: "Sign in required",
    body: "You need to be signed in to open this page.",
    action: "Go to Login",
  },
  unverified: {
    icon: "mail",
    emoji: "📧",
    title: "Verify your email",
    body: "Confirm your email address to unlock the rest of NutriFitAI.",
    action: "Verify Email",
  },
  forbidden: {
    icon: "ban",
    emoji: "⛔",
    title: "Access denied",
    body: "Your account doesn't have permission to view this page.",
    action: "Back to Home",
  },
  "admin-web-only": {
    icon: "desktop-outline",
    emoji: "🖥️",
    title: "Please use the web app",
    body: "Admin and superadmin accounts aren't supported on mobile. Please sign in from the web interface instead.",
    action: "Logout and Go to Login",
  },
};

function firstParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

// The access-denied screen's variant and actions, for both platforms
export function useAccessDenied() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, role, signOut } = useAuth();

  const reason = firstParam(params.reason) || "unauthenticated";
  const from = firstParam(params.from);
  const variant = VARIANTS[reason] || VARIANTS.unauthenticated;

  async function handlePrimary() {
    if (reason === "unverified") {
      router.replace({ pathname: "/verify-registration", params: { email: user?.email } });
      return;
    }
    if (reason === "forbidden") {
      router.replace(homeFor(role));
      return;
    }

    // unauthenticated/web-admin-only flagged
    // clear any stale token, then send user to login.
    await signOut();
    router.replace({ pathname: "/login", params: from ? { next: from } : {} });
  }

  // Signed-in variants also offer a plain sign out
  const canSignOut = reason !== "unauthenticated" && reason !== "admin-web-only";

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return { variant, handlePrimary, canSignOut, handleSignOut };
}
