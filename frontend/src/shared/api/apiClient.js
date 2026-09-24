import { clearAccessToken, getAccessToken, setAccessToken } from "@/shared/utils/authStorage";
import Constants from "expo-constants";

/**
 * Base URL of the NutriFit API, resolved at startup rather than hardcoded.
 * 
 * The app was DOWNLOADED from Metro, running on the dev machine, so the host
 * the bundle arrived from is by definition the machine the API is on too.
 * Expo publishes that as `hostUri` -- e.g. "192.168.1.42:8081" on LAN, or the
 * tunnel host when running `--tunnel`. Reusing its hostname with the API port
 * means the address is rediscovered on every launch and never needs editing
 *
 * PRECEDENCE, and why this order:
 *   1. EXPO_PUBLIC_API_URL, when set -- an explicit override must always win
 *      (production builds, or pointing at a staging server on purpose)
 *   2. On web, the page's own origin's hostname -- the browser already
 *      reached this host, so it is reachable by definition
 *   3. hostUri from Expo
 *   4. localhost -- simulator only. On a physical device "localhost" is the
 *      PHONE, which is why this is last and not the default it used to be
 *
 * Only the hostname is taken from hostUri; the port is always the API's own
 * (8081 is Metro, not the server). Set EXPO_PUBLIC_API_PORT if it is not 4000
 */
const API_PORT = process.env.EXPO_PUBLIC_API_PORT || "4000";

function resolveBaseUrl() {
  const explicit = (process.env.EXPO_PUBLIC_API_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  // Web: same host that served the page.
  if (typeof window !== "undefined" && window.location && window.location.hostname) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${API_PORT}/api`;
  }

  /**
   * Native. hostUri lives in different places across SDK versions and build
   * types, so each is tried rather than assuming one shape -- a missing key
   * here would silently fall through to localhost and fail only on a real
   * device, which is the slowest possible place to notice
   */
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    null;

  if (hostUri) {
    // Strip any scheme, then the port -- keeping Metro's 8081 would point at
    // the bundler instead of the API
    const host = String(hostUri).replace(/^\w+:\/\//, "").split("/")[0].split(":")[0];
    if (host) return `http://${host}:${API_PORT}/api`;
  }

  return `http://localhost:${API_PORT}/api`;
}

const BASE_URL = resolveBaseUrl();

if (__DEV__) {
  // Printed once at startup: when a device cannot reach the API this is the
  // single most useful line to see, and it costs nothing to log
  console.log(`[apiClient] base URL: ${BASE_URL}`);
}

/** Abort a request that the server never answers, so callers don't hang forever */
const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Thin wrapper around the backend's { success, data } / { success:false, code,
 * message, details } envelope (see src/middleware/errorHandlerMiddleware.js /
 * src/utils/httpResponse.js on the server). Throws an ApiClientError on any non-2xx
 * response or network failure so callers can catch a single error type
 */
export class ApiClientError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code; // e.g. "EMAIL_NOT_VERIFIED", "UNAUTHORIZED", "VALIDATION_FAILED"
    this.details = details;
  }
}

/**
 * Human labels for the field names used by validators/authValidators.js, so a
 * zod issue on "heightCm" reads as "Height" rather than the raw key
 */
const FIELD_LABELS = {
  fullName: "Full name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
  age: "Age",
  heightCm: "Height",
  weightKg: "Weight",
  gender: "Gender",
  goal: "Goal",
  termsAccepted: "Terms",
  code: "Verification code",
  resetToken: "Reset session",
  rememberMe: "Remember me",
  exchangeToken: "Sign-in token",
  redirectUri: "Redirect URL",
};

/**
 * validateBody() rejects with the generic message "Validation failed" and puts
 * the useful per-field reasons in `details`. Nothing was rendering `details`,
 * so the user only ever saw "Validation failed" — flatten it into a readable
 * message instead
 * @param {Array<{ path?: string, message?: string }>|undefined} details
 */
export function formatValidationDetails(details) {
  if (!Array.isArray(details)) return "";

  const lines = details
    .map((detail) => {
      if (typeof detail === "string") return detail;
      const message = detail && detail.message;
      if (!message) return "";
      const key = detail.path ? String(detail.path).split(".").pop() : "";
      const label = FIELD_LABELS[key] || (key ? key : "");
      return label ? `${label}: ${message}` : message;
    })
    .filter(Boolean);

  return lines.join("\n");
}

/** Last-resort copy when the server sends no usable message (proxy pages, 502s, …) */
function statusFallbackMessage(status) {
  if (status === 400) return "That request wasn't valid. Please check the form and try again.";
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find that on the server. Please try again later.";
  if (status === 409) return "That conflicts with an existing record.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status >= 500) return "The server ran into a problem. Please try again shortly.";
  return `Request failed (${status})`;
}

/** The rate limiters reply with a bare { success:false, message } and no code */
function codeFallback(status) {
  if (status === 429) return "RATE_LIMITED";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status >= 500) return "INTERNAL";
  return "ERROR";
}

/**
 * Lets AuthContext learn about a session dying from WHEREVER it's discovered,
 * not just from its own /auth/me check
 *
 * apiClient is a plain module with no knowledge of React state, and
 * AuthContext already imports from apiClient (never the reverse) — so this is
 * a one-directional registration point rather than a circular import: React
 * hands apiClient a callback once, apiClient calls it when it has something
 * to report. Deliberately a single slot, not an event emitter with multiple
 * subscribers — there is exactly one thing in this app that owns "is there a
 * session" (AuthContext's own doc comment says as much), so there is only
 * ever one listener to register
 */
let onSessionExpired = null;
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

/**
 * Separate slot for "the server could not be reached", which is NOT the same
 * event as "the session is over" and must not be treated as one
 */
let onSessionUnreachable = null;
export function setSessionUnreachableHandler(fn) {
  onSessionUnreachable = fn;
}

/**
 * True when a failure says nothing about whether the session is still valid:
 * no network, a timeout, or a server-side fault. status 0 is this client's
 * own marker for NETWORK_ERROR / TIMEOUT (see request())
 */
function isTransportFailure(err) {
  const status = err instanceof ApiClientError ? err.status : 0;
  return status === 0 || status >= 500;
}

/**
 * Coalesces concurrent refresh attempts into one network call
 *
 * A screen that fires several auth:true requests at once (a dashboard loading
 * steps + workouts + profile in parallel, say) can have all of them 401 in
 * the same tick if the access token expired between renders. Without this,
 * each one would independently POST /auth/refresh — three redundant calls
 * that all race to write the same token to storage. Every caller instead
 * awaits the same in-flight promise, and it's cleared once that settles so
 * the NEXT expiry still triggers a fresh attempt rather than reusing a dead
 * promise forever
 *
 * @returns {Promise<string>} the new access token
 */
let refreshPromise = null;
function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const data = await request("/auth/refresh", { method: "POST" });
        await setAccessToken(data.accessToken);
        return data.accessToken;
      } catch (err) {
        /**
         * Every failure here used to clear the stored token and declare the
         * session over. But this catch fires for two completely different
         * situations, and only one of them means anything about the session:
         *
         *   - the refresh cookie is genuinely gone, expired or invalid (401);
         *   - the request never reached the server at all -- Wi-Fi dropped,
         *     the laptop running the API is asleep, a timeout, a 502
         *
         * Treating the second as the first is what logged people out whenever
         * the connection blipped: clearAccessToken() DELETED a perfectly good
         * token from storage, so the session could not recover even once the
         * network came back. Reloading then genuinely had no credentials left
         *
         * A transport failure is now non-destructive: the token stays, and
         * the app is told the server is unreachable so it can show that and
         * retry, rather than pretending the user signed out
         */
        if (isTransportFailure(err)) {
          if (onSessionUnreachable) onSessionUnreachable(err);
          throw err;
        }

        // A real authentication failure. Nothing here can recover, so drop
        // the now-useless access token: AuthContext's next check then reads a
        // clean "logged out" state instead of a stale token that will only
        // 401 again
        await clearAccessToken();

        // Fires exactly once per dead session, however many requests were
        // in flight when it was discovered: every caller of refreshAccessToken()
        // during that window awaits this SAME promise (see refreshPromise
        // above), so this catch runs once, not once per caller
        if (onSessionExpired) onSessionExpired();

        throw err;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/**
 * @param {string} path e.g. "/auth/login" (leading slash, no BASE_URL prefix)
 * @param {{ method?: string, body?: any, auth?: boolean, full?: boolean, timeoutMs?: number }} [options]
 *   `full: true` resolves with the whole envelope ({ success, message, data })
 *   instead of just `data`, for callers that want to show the server's own
 *   success message rather than hardcoding their own.
 * @param {boolean} [isRetry] internal only -- marks a request as already
 *   having gone through one refresh-and-retry cycle, so a second 401 (a
 *   genuinely dead session, not just an expired access token) falls straight
 *   through to the caller instead of looping
 */
async function request(
  path,
  { method = "GET", body, auth = false, full = false, timeoutMs = DEFAULT_TIMEOUT_MS } = {},
  isRetry = false,
) {
  // FormData must NOT get an explicit Content-Type: the runtime sets it along
  // with the multipart boundary, and overriding it makes the body unparseable
  // on the server
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = isFormData ? {} : { "Content-Type": "application/json" };

  // Free ngrok endpoints serve an HTML interstitial to browser user-agents on
  // GET requests. That breaks JSON parsing, and AuthContext reads any /auth/me
  // failure as "logged out" — so the guard bounces a valid session
  headers["ngrok-skip-browser-warning"] = "true";  

  if (auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller && timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      credentials: "include", // send/receive the httpOnly refresh cookie
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal: controller ? controller.signal : undefined,
    });
  } catch (networkErr) {
    if (networkErr && networkErr.name === "AbortError") {
      throw new ApiClientError("The server took too long to respond. Please try again.", {
        status: 0,
        code: "TIMEOUT",
      });
    }
    throw new ApiClientError("Unable to reach the server. Check your connection and try again.", {
      status: 0,
      code: "NETWORK_ERROR",
    });
  } finally {
    if (timer) clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (parseErr) {
    // Non-JSON response (e.g. a proxy error page) — fall through with no payload
  }

  if (!response.ok || !payload || payload.success === false) {
    // A 401 on an authenticated request most often means the short-lived
    // access token expired mid-session (15m by default) — not that the user
    // was deliberately logged out. Try once to silently exchange the
    // httpOnly refresh cookie for a new access token and replay the original
    // request, so an expired token surfaces as a slightly slower response
    // rather than an unexpected trip back to the login screen
    //
    // Excludes /auth/refresh itself: a 401 FROM that endpoint means the
    // refresh cookie is the thing that's dead, and retrying it would recurse
    // forever via refreshAccessToken() calling back into request()
    if (response.status === 401 && auth && !isRetry && path !== "/auth/refresh") {
      try {
        await refreshAccessToken();
        return request(path, { method, body, auth, full, timeoutMs }, true);
      } catch {
        // Refresh failed too (refresh cookie missing/expired/invalid) — fall
        // through and report the ORIGINAL 401 below, exactly as if no retry
        // had been attempted. AuthContext already treats a 401 from /auth/me
        // as "log the user out", which is the correct outcome here
      }
    }

    const details = payload && payload.details;
    const detailMessage = formatValidationDetails(details);
    const serverMessage = payload && payload.message;

    // Prefer the specific per-field reasons over the generic wrapper message
    const message = detailMessage || serverMessage || statusFallbackMessage(response.status);

    throw new ApiClientError(message, {
      status: response.status,
      code: (payload && payload.code) || codeFallback(response.status),
      details,
    });
  }

  return full ? payload : payload.data;
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),

  /** Multipart POST. Pass a FormData; headers are left to the runtime */
  upload: (path, formData, options) => request(path, { ...options, method: "POST", body: formData }),
};

export { BASE_URL as API_BASE_URL };

