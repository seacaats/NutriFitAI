import {
  apiClient,
  ApiClientError,
  setSessionExpiredHandler,
  setSessionUnreachableHandler,
} from "@/shared/api/apiClient";
import { onReconnect } from "@/shared/api/connection";
import { clearCached } from "@/shared/api/offlineCache";
import LoadingScreen, { useLoadingGate } from "@/shared/components/ui/LoadingScreen";
import { resolveMediaUrl } from "@/shared/services/mediaUrl";
import { colors } from "@/shared/theme/nutrifitai";
import { resetGoogleAuthChannel } from "@/shared/utils/authChannel";
import { clearAccessToken, getAccessToken } from "@/shared/utils/authStorage";
import { clearRemembered } from "@/shared/utils/rememberedState";
import { usePathname, useRouter } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Single source of truth for session validity and role permissions.
 *
 * Stored access token existence is confirmed against GET /auth/me on startup.
 * The active role is derived server-side from the verified token.
 */
const AuthContext = createContext(null);

/**
 * Mirrors the `role` enum in models/user/User.js and ROLES in middleware/authMiddleware.js.
 */
export const ROLES = ["user", "admin"];
export const DEFAULT_ROLE = "user";

export const AUTH_STATUS = {
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  ANONYMOUS: "anonymous",
  /**
   * Token is held but the server is currently unreachable to confirm it.
   * Keeps the current view and retries rather than immediately redirecting
   * to the login screen during intermittent connection drops.
   */
  UNREACHABLE: "unreachable",
};

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(AUTH_STATUS.LOADING);
  const [user, setUser] = useState(null);
  // True after explicit logout so navigation targets landing instead of login
  const [loggedOut, setLoggedOut] = useState(false);

  const loadSession = useCallback(async () => {
    const token = await getAccessToken();

    if (!token) {
      setUser(null);
      setStatus(AUTH_STATUS.ANONYMOUS);
      return null;
    }

    try {
      const data = await apiClient.get("/auth/me", { auth: true, wait: false });

      // Resolve root-relative avatar path into an absolute media URL
      setUser(data ? { ...data, avatarUrl: resolveMediaUrl(data.avatarUrl) } : null);
      setStatus(AUTH_STATUS.AUTHENTICATED);
      setLoggedOut(false);
      return data || null;
    } catch (err) {
      const status = err instanceof ApiClientError ? err.status : 0;

      /**
       * Handles authentication errors:
       * 401: Token expired, invalid, or unrecognized signature -> clear session.
       * 403: Authenticated but unauthorized -> clear session.
       * Other network/server errors keep the token and mark the session unreachable.
       */
      if (status === 401) {
        await clearAccessToken();
        await clearCached();
        setUser(null);
        setStatus(AUTH_STATUS.ANONYMOUS);
        return null;
      }

      if (status === 403) {
        setUser(null);
        setStatus(AUTH_STATUS.ANONYMOUS);
        return null;
      }

      // Mark session unreachable on transient or network failures without dropping credentials
      setUser(null);
      setStatus(AUTH_STATUS.UNREACHABLE);
      return null;
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Check session again once network reconnection is detected
  const statusRef = useRef(status);
  statusRef.current = status;
  useEffect(
    () => onReconnect(() => statusRef.current === AUTH_STATUS.UNREACHABLE && loadSession()),
    [loadSession],
  );

  /**
   * Session state handlers for apiClient discovery of expired or unreachable sessions.
   */
  useEffect(() => {
    setSessionExpiredHandler(() => {
      clearCached();
      setUser(null);
      setStatus(AUTH_STATUS.ANONYMOUS);
    });

    setSessionUnreachableHandler(() => {
      // Retain existing authenticated state if already loaded
      setStatus((current) =>
        current === AUTH_STATUS.ANONYMOUS || current === AUTH_STATUS.AUTHENTICATED ? current : AUTH_STATUS.UNREACHABLE,
      );
    });
  }, []);

  // byUser: true for explicit user logout
  const signOut = useCallback(async ({ byUser = false } = {}) => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Local state is cleared regardless of network response
    }
    await clearAccessToken();
    await clearCached();
    await clearRemembered();
    // Clear pending Google auth channel messages
    resetGoogleAuthChannel();
    setUser(null);
    setLoggedOut(byUser);
    setStatus(AUTH_STATUS.ANONYMOUS);
  }, []);

  const value = useMemo(() => {
    const role = user?.role || DEFAULT_ROLE;

    // Derived display helpers
    const fullName = user?.fullName || "";
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = user?.firstName || parts[0] || "there";
    const lastName = user?.lastName || parts.slice(1).join(" ") || "";
    const initials = parts.length
      ? parts.map((n) => n[0]).slice(0, 2).join("").toUpperCase()
      : "?";

    return {
      status,
      loading: status === AUTH_STATUS.LOADING,
      isAuthenticated: status === AUTH_STATUS.AUTHENTICATED,
      /** Token held, server unconfirmable. Not signed out -- retry, don't redirect. */
      isUnreachable: status === AUTH_STATUS.UNREACHABLE,
      user,
      role,
      emailVerified: Boolean(user?.emailVerified),
      onboarded: user?.onboarded !== false,
      setupPending: Boolean(user?.setupPending),

      email: user?.email,
      fullName: fullName || null,
      firstName,
      lastName,
      initials,

      /** Exact-match check: hasRole("admin"). */
      hasRole: (...allowed) => allowed.flat().includes(role),

      refresh: loadSession,
      signOut,
      loggedOut,
    };
  }, [status, user, loggedOut, loadSession, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }
  return ctx;
}

/**
 * Route access map and role landing destinations.
 * Used by RoleGuard, navigation layouts, and post-login redirects.
 */

const ADMIN_ROLES = ["admin"];

/** Where each role lands after sign-in (and when bounced off another role's screen) */
const HOME_BY_ROLE = {
  user: "/dashboard",
  admin: "/analytics",
};

export function homeFor(role) {
  return HOME_BY_ROLE[role] || HOME_BY_ROLE.user;
}

/**
 * Pathname prefix to allowed roles mapping.
 * Sub-paths inherit the parent route's permission rules.
 */
const ROUTE_ROLES = [
  // User-only
  ["/dashboard", ["user"]],
  ["/food-scanner", ["user"]],
  ["/workouts", ["user"]],
  ["/ai-coach", ["user"]],
  ["/progress", ["user"]],
  ["/steps", ["user"]],
  ["/water", ["user"]],
  ["/onboarding", ["user"]],

  // Every signed-in role
  ["/profile", ROLES],
  ["/notifications", ROLES],
  ["/settings", ROLES],

  // Admin
  ["/analytics", ADMIN_ROLES],
  ["/users", ADMIN_ROLES],
  ["/image-reviews", ADMIN_ROLES],
  ["/audit-logs", ADMIN_ROLES],
];

/** Allowed roles for a pathname, or null when the route isn't listed */
function rolesFor(pathname) {
  const match = ROUTE_ROLES.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match ? match[1] : null;
}

export function canAccess(role, pathname) {
  const allowed = rolesFor(pathname);
  return Boolean(allowed && allowed.includes(role));
}

// Validates in-app return path against user role permissions
export function safeReturnTo(next, role) {
  const path = Array.isArray(next) ? next[0] : next;
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return homeFor(role);
  const pathname = path.split(/[?#]/)[0];
  return canAccess(role, pathname) ? path : homeFor(role);
}

/**
 * Shared layout route guard for authenticated views.
 *
 * Check sequence:
 *  1. Session loading / server unreachable -> spinner / retry view
 *  2. Not signed in                        -> redirect to /login or /
 *     Email unverified                     -> redirect to /access-denied
 *  3. Admin on native                      -> redirect to /access-denied (web-only admin)
 *  4. Role mismatch                        -> redirect to role home or /access-denied
 */
export function RoleGuard({ children }) {
  const { status, isAuthenticated, emailVerified, role, refresh, loggedOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  // When a public route is pushed on top of a guarded route, the background guard stands down
  const guardedOnce = useRef(false);
  const gate = useLoadingGate(status === AUTH_STATUS.LOADING);
  const listed = Boolean(rolesFor(pathname));
  if (listed) guardedOnce.current = true;
  const standingDown = !listed && guardedOnce.current;

  // Resolved destination or null if screen is accessible
  const target = standingDown || gate.pending || status === AUTH_STATUS.UNREACHABLE
    ? null
    : redirectFor({ isAuthenticated, emailVerified, role, loggedOut, pathname });

  // Tracks current destination to avoid redundant navigations
  const sentTo = useRef(null);
  useEffect(() => {
    if (!target) {
      sentTo.current = null;
      return;
    }
    if (sentTo.current === target) return;
    sentTo.current = target;
    router.replace(target);
  }, [target, router]);

  // Root navigator remains mounted while loading or redirect covers are overlaid
  let cover = null;
  if (gate.pending) cover = <LoadingScreen visible={gate.visible} />;
  // Token held but the server cannot be reached to confirm it
  else if (status === AUTH_STATUS.UNREACHABLE) cover = (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12, backgroundColor: colors.bgMint }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
        We can&apos;t connect right now
      </Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", maxWidth: 320, lineHeight: 19 }}>
        You&apos;re still signed in. Check your connection and try again.
      </Text>
      <Pressable
        onPress={refresh}
        style={{ backgroundColor: colors.green600, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 11 }}
      >
        <Text style={{ color: colors.white, fontWeight: "700", fontSize: 14 }}>Retry</Text>
      </Pressable>
    </View>
  );
  // Route transition cover
  else if (target) cover = <View style={{ flex: 1, backgroundColor: colors.bgMint }} />;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {!standingDown && cover && <View style={StyleSheet.absoluteFill}>{cover}</View>}
    </View>
  );
}

// Evaluates redirection target for current auth state and route
function redirectFor({ isAuthenticated, emailVerified, role, loggedOut, pathname }) {
  const from = encodeURIComponent(pathname);
  if (!isAuthenticated) {
    return loggedOut ? "/" : `/login?next=${from}`;
  }
  if (!emailVerified) return `/access-denied?reason=unverified&from=${from}`;

  const privileged = ADMIN_ROLES.includes(role);
  if (Platform.OS !== "web" && privileged) return `/access-denied?reason=admin-web-only&from=${from}`;

  if (!canAccess(role, pathname)) {
    const allowed = rolesFor(pathname);
    const userOnlyScreen = Boolean(allowed) && allowed.every((r) => r === "user");
    if (privileged && userOnlyScreen) return homeFor(role);
    return `/access-denied?reason=forbidden&from=${from}`;
  }
  return null;
}
