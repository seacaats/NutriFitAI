import {
    apiClient,
    ApiClientError,
    setSessionExpiredHandler,
    setSessionUnreachableHandler,
} from "@/shared/api/apiClient";
import { resolveMediaUrl } from "@/shared/services/mediaUrl";
import { clearAccessToken, getAccessToken } from "@/shared/utils/authStorage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Single source of truth for "is there a valid session, and what may it do".
 *
 * A stored access token only proves one existed at some point, so the session
 * is always confirmed against GET /auth/me rather than trusted locally. The
 * role comes from that response, which is derived server-side from the signed
 * token — never from anything the client can set.
 */
const AuthContext = createContext(null);

/**
 * Weakest first. Used for hierarchical checks (an admin satisfies 'user').
 * Mirrors the `role` enum in the backend's models/schemas/userSchema.js and
 * ROLES in its middleware/authMiddleware.js.
 *
 * Order is load-bearing: hasAtLeastRole compares indexes, so appending a
 * stronger role is safe while inserting one mid-list silently re-ranks
 * everything after it.
 *
 * Worth restating what this list is NOT: it is a rendering aid. The role it
 * ranks arrives from GET /auth/me, derived server-side from the signed token,
 * and every decision that matters is re-made by the API. Hiding a nav item is
 * a usability choice; the endpoint behind it is what is actually protected.
 */
export const ROLES = ["user", "admin", "superadmin"];
export const DEFAULT_ROLE = "user";

export const AUTH_STATUS = {
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  ANONYMOUS: "anonymous",
  /**
   * We hold a token but cannot currently reach the server to confirm it.
   *
   * This state exists because collapsing it into ANONYMOUS is what logged
   * people out every time the connection dropped. "Not signed in" and "cannot
   * ask right now" demand opposite responses: the first should send you to
   * the login screen, the second should keep you where you are and retry.
   * With one state for both, a dropped Wi-Fi was indistinguishable from
   * signing out.
   */
  UNREACHABLE: "unreachable",
};

export function AuthProvider({ children }) {
  const [status, setStatus] = useState(AUTH_STATUS.LOADING);
  const [user, setUser] = useState(null);

  const loadSession = useCallback(async () => {
    const token = await getAccessToken();

    if (!token) {
      setUser(null);
      setStatus(AUTH_STATUS.ANONYMOUS);
      return null;
    }

    try {
      const data = await apiClient.get("/auth/me", { auth: true });

      // The server returns avatarUrl as a root-relative path. Resolving it here,
      // once, means every consumer of useAuth() gets a loadable URL -- rather
      // than each screen remembering to do it and the mobile ones silently
      // rendering initials when they forget.
      setUser(data ? { ...data, avatarUrl: resolveMediaUrl(data.avatarUrl) } : null);
      setStatus(AUTH_STATUS.AUTHENTICATED);
      return data || null;
    } catch (err) {
      const status = err instanceof ApiClientError ? err.status : 0;

      /**
       * Only an AUTHENTICATION failure means "not logged in".
       *
       * 401 -> the token is expired, malformed, or signed with a secret this
       *        server no longer uses. This is the stale-token case: rotating
       *        JWT_ACCESS_SECRET, or reinstalling the backend against a new
       *        database, leaves a token on the device that verifies against
       *        nothing. It can never recover on its own, so it is cleared.
       *
       * 403 -> authenticated but not permitted. Previously treated the same as
       *        401 and the token was DISCARDED, which is wrong: the session is
       *        valid, the user simply lacks a right. Throwing away a working
       *        token turns a permissions problem into a forced re-login.
       *
       * Anything else -- 404, 500, a timeout, a dropped connection, an ngrok
       * interstitial -- says nothing about the session. The old code treated
       * every one of these as logged out, which is why a single failing
       * request bounced a perfectly good session to /access-denied with
       * reason=unauthenticated. The token is kept so the next successful call
       * recovers, and the failure is logged rather than silently swallowed.
       */
      if (status === 401) {
        await clearAccessToken();
        setUser(null);
        setStatus(AUTH_STATUS.ANONYMOUS);
        return null;
      }

      if (status === 403) {
        setUser(null);
        setStatus(AUTH_STATUS.ANONYMOUS);
        return null;
      }

      /**
       * Anything else -- a timeout, a dropped connection, a 500, an ngrok
       * interstitial -- says NOTHING about the session.
       *
       * The old code logged exactly this ("keeping the stored token") and
       * then set ANONYMOUS one line later, which the route guard reads as
       * signed out and redirects on. So the token was kept and the user was
       * still thrown to /access-denied -- the comment and the behaviour
       * disagreed, and the behaviour won.
       *
       * UNREACHABLE keeps the token AND keeps the user in place. The next
       * successful call recovers the session with no re-login.
       */
      console.warn(
        `[auth] /auth/me failed with status ${status || "network"} — keeping the stored token.`,
        err?.message,
      );

      setUser(null);
      setStatus(AUTH_STATUS.UNREACHABLE);
      return null;
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  /**
   * apiClient discovers a dead refresh cookie mid-request, on whichever
   * screen happened to be calling at the time -- not necessarily this
   * context's own loadSession()/`/auth/me` check. Registering here is what
   * lets that discovery, from anywhere, still flip status to ANONYMOUS and
   * trip the (main)/_layout.jsx redirect, instead of only failing silently
   * on the one screen that made the request.
   *
   * No cleanup on unmount: AuthProvider lives for the app's lifetime (it
   * wraps the root layout), so there's nothing to unregister in practice --
   * and leaving a stale handler registered across a remount that can't
   * happen isn't a real leak.
   */
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus(AUTH_STATUS.ANONYMOUS);
    });

    /**
     * Discovered from any screen's request, not just this context's own
     * /auth/me. Deliberately does NOT clear the user: the session is
     * presumed intact and simply unconfirmable, so whatever is on screen
     * stays usable rather than blanking out.
     */
    setSessionUnreachableHandler(() => {
      setStatus((current) =>
        current === AUTH_STATUS.ANONYMOUS ? current : AUTH_STATUS.UNREACHABLE,
      );
    });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch {
      // Clearing locally matters more than the server acknowledging it.
    }
    await clearAccessToken();
    setUser(null);
    setStatus(AUTH_STATUS.ANONYMOUS);
  }, []);

  const value = useMemo(() => {
    const role = user?.role || DEFAULT_ROLE;
    const rank = ROLES.indexOf(role);

    // Display helpers, derived once here rather than in each screen. Prefers
    // the split name columns and falls back to full_name, which is all a
    // Google-linked account may have.
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

      email: user?.email,
      fullName: fullName || null,
      firstName,
      lastName,
      initials,

      /** Exact-match check: hasRole("admin"). */
      hasRole: (...allowed) => allowed.flat().includes(role),

      /** Hierarchical check: an admin satisfies hasAtLeastRole("user"). */
      hasAtLeastRole: (minimum) => {
        const needed = ROLES.indexOf(minimum);
        return needed >= 0 && rank >= needed;
      },

      refresh: loadSession,
      signOut,
    };
  }, [status, user, loadSession, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }
  return ctx;
}