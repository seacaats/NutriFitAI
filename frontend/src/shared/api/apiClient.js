import { checkNow, hasNoConnection, isOffline, noteSavedData, onConnectionChange, onReconnect, setOffline, setOnline, setPingBase, waitForOnline } from "@/shared/api/connection";
import { isCacheable, readCached, saveCached } from "@/shared/api/offlineCache";
import { clearNetworkError, reportNetworkError, rewordNetworkError } from "@/shared/state/screenErrors";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/shared/utils/authStorage";
import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * Resolves the base URL for the API at startup.
 * Precedence:
 * 1. EXPO_PUBLIC_API_URL (explicit override for production/staging)
 * 2. Window origin hostname on web
 * 3. Expo hostUri (local development via LAN/tunnel)
 * 4. Production backend on release builds (!__DEV__)
 * 5. Localhost fallback
 */
const API_PORT = process.env.EXPO_PUBLIC_API_PORT || "4000";
const PRODUCTION_API_URL = "https://nutrifitaibackend.onrender.com/api";

function resolveBaseUrl() {
  const explicit = (process.env.EXPO_PUBLIC_API_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  // Web: same host that served the page.
  if (typeof window !== "undefined" && window.location && window.location.hostname) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${API_PORT}/api`;
  }

  // Native: inspects available hostUri properties from Expo config
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    null;

  if (hostUri) {
    // Strip scheme and bundler port to target the API port
    const host = String(hostUri).replace(/^\w+:\/\//, "").split("/")[0].split(":")[0];
    if (host) return `http://${host}:${API_PORT}/api`;
  }

  // Release / standalone builds without a dev server target the production backend
  if (!__DEV__) {
    return PRODUCTION_API_URL;
  }

  return `http://localhost:${API_PORT}/api`;
}

const BASE_URL = resolveBaseUrl();
setPingBase(BASE_URL);

/**
 * Returns user-facing message when requests fail to connect.
 */
export function unreachableMessage() {
  return hasNoConnection()
    ? "You're not connected to the internet. Connect to Wi-Fi or mobile data and try again."
    : "We're having trouble connecting right now. Please try again in a moment.";
}

if (__DEV__) {
  console.log(`[apiClient] base URL: ${BASE_URL}`);
}

// Device IANA zone ("Asia/Manila"), or null if unavailable
function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Abort a request that the server never answers, so callers don't hang forever */
const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Standard API error wrapper around the server's response envelope.
 */
export class ApiClientError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code; // e.g. "UNAUTHORIZED", "VALIDATION_FAILED", "RATE_LIMITED"
    this.details = details;
  }
}

/**
 * Human-readable field labels for validation error formatting.
 */
const FIELD_LABELS = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  email: "Email",
  password: "Password",
  confirmPassword: "Confirm password",
  age: "Age",
  heightCm: "Height",
  weightKg: "Weight",
  sex: "Sex",
  goal: "Goal",
  fitnessGoal: "Goal",
  activityLevel: "Activity level",
  dietPreference: "Diet preference",
  healthConditions: "Health conditions",
  termsAccepted: "Terms",
  code: "Verification code",
  resetToken: "Reset session",
  rememberMe: "Remember me",
  exchangeToken: "Sign-in token",
  redirectUri: "Redirect URL",
  dailyCaloriesKcal: "Calories",
  dailyProteinG: "Protein",
  dailyCarbsG: "Carbs",
  dailyFatG: "Fat",
  dailySteps: "Daily steps",
  dailyWaterMl: "Daily water",
  targetWeightKg: "Target weight",
  weeklyPaceKg: "Weekly pace",
  workoutPrefs: "Workout preferences",
  coachTone: "Coach tone",
};

/**
 * Formats structured validation issues into human-readable text.
 * @param {Array<{ path?: string, message?: string }>|undefined} details
 */
function formatValidationDetails(details) {
  if (!Array.isArray(details)) return "";

  const lines = details
    .map((detail) => {
      if (typeof detail === "string") return detail;
      const message = detail && detail.message;
      if (!message) return "";
      const key = detail.path ? String(detail.path).split(".").pop() : "";
      const label = FIELD_LABELS[key] || (key ? key : "");
      if (!label || message.toLowerCase().includes(label.toLowerCase())) return message;
      return `${label}: ${message}`;
    })
    .filter(Boolean);

  return lines.join("\n");
}

/** Fallback user-facing message when server provides no payload */
function statusFallbackMessage(status) {
  if (status === 400) return "Something doesn't look right. Please check what you entered and try again.";
  if (status === 401) return "Your session has expired. Please log in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "We couldn't find what you're looking for.";
  if (status === 409) return "That already exists.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our end. Please try again shortly.";
  return "Something went wrong. Please try again.";
}

/** Code fallback for unformatted HTTP errors */
function codeFallback(status) {
  if (status === 429) return "RATE_LIMITED";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status >= 500) return "INTERNAL";
  return "ERROR";
}

let onSessionExpired = null;
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

let onSessionUnreachable = null;
export function setSessionUnreachableHandler(fn) {
  onSessionUnreachable = fn;
}

/** True when the failure is transport-related and does not indicate an expired session */
function isTransportFailure(err) {
  const status = err instanceof ApiClientError ? err.status : 0;
  return status === 0 || status >= 500;
}

/**
 * Coalesces concurrent refresh attempts into a single network call.
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
        // Transport failures are non-destructive to preserve stored credentials
        if (isTransportFailure(err)) {
          if (onSessionUnreachable) onSessionUnreachable(err);
          throw err;
        }

        // On genuine auth failure, clear token and notify session listener
        await clearAccessToken();
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
 * @param {boolean} [isRetry] internal flag for refresh retry handling
 */
async function request(
  path,
  { method = "GET", body, auth = false, full = false, as = "json", timeoutMs = DEFAULT_TIMEOUT_MS, signal } = {},
  isRetry = false,
) {
  if (signal?.aborted) throw cancelledError();

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = isFormData ? {} : { "Content-Type": "application/json" };

  headers["ngrok-skip-browser-warning"] = "true";
  const timeZone = deviceTimeZone();
  if (timeZone) headers["X-Timezone"] = timeZone;

  if (auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller && timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const cancel = () => controller?.abort();
  signal?.addEventListener?.("abort", cancel);

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
    if (signal?.aborted) throw cancelledError();
    if (networkErr && networkErr.name === "AbortError") {
      throw new ApiClientError("This is taking longer than expected. Please try again.", {
        status: 0,
        code: "TIMEOUT",
      });
    }
    throw new ApiClientError(unreachableMessage(), {
      status: 0,
      code: "NETWORK_ERROR",
    });
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener?.("abort", cancel);
  }
  if (signal?.aborted) throw cancelledError();

  if (as === "text" && response.ok) return response.text();

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response (e.g. proxy error page)
  }

  if (!response.ok || !payload || payload.success === false) {
    // Retry once with a refreshed token on 401 for authenticated requests (except /auth/refresh)
    if (response.status === 401 && auth && !isRetry && path !== "/auth/refresh") {
      try {
        await refreshAccessToken();
        return request(path, { method, body, auth, full, as, timeoutMs, signal }, true);
      } catch {
        // Refresh failed; fall through to return original 401
      }
    }

    const details = payload && payload.details;
    const detailMessage = formatValidationDetails(details);
    const serverMessage = payload && payload.message;
    const message = detailMessage || serverMessage || statusFallbackMessage(response.status);

    throw new ApiClientError(message, {
      status: response.status,
      code: (payload && payload.code) || codeFallback(response.status),
      details,
    });
  }

  return full ? payload : payload.data;
}

/**
 * Uploads one local file as multipart/form-data.
 * Uses expo-file-system on native to avoid multipart bugs, FormData on web.
 */
async function uploadFile(path, file, { field = "file", auth = false, timeoutMs = DEFAULT_TIMEOUT_MS } = {}, isRetry = false) {
  if (Platform.OS === "web") {
    const formData = new FormData();
    const blob = await (await fetch(file.uri)).blob();
    formData.append(field, blob, file.name || "upload");
    return request(path, { method: "POST", body: formData, auth, timeoutMs });
  }

  const FileSystem = require("expo-file-system/legacy");

  const headers = { "ngrok-skip-browser-warning": "true" };
  const timeZone = deviceTimeZone();
  if (timeZone) headers["X-Timezone"] = timeZone;
  if (auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let result;
  try {
    const upload = FileSystem.uploadAsync(`${BASE_URL}${path}`, file.uri, {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: field,
      mimeType: file.type || "application/octet-stream",
      headers,
    });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs));
    result = await Promise.race([upload, timeout]);
  } catch (err) {
    if (err?.message === "timeout") {
      throw new ApiClientError("This is taking longer than expected. Please try again.", { status: 0, code: "TIMEOUT" });
    }
    const reason = __DEV__ && err?.message ? ` (${err.message})` : "";
    throw new ApiClientError(`${unreachableMessage()}${reason}`, {
      status: 0,
      code: "NETWORK_ERROR",
    });
  }

  let payload = null;
  try {
    payload = JSON.parse(result.body);
  } catch {
    // Non-JSON body
  }

  const ok = result.status >= 200 && result.status < 300;
  if (!ok || !payload || payload.success === false) {
    if (result.status === 401 && auth && !isRetry) {
      try {
        await refreshAccessToken();
        return uploadFile(path, file, { field, auth, timeoutMs }, true);
      } catch {
        // Refresh failed
      }
    }
    const details = payload && payload.details;
    const message = formatValidationDetails(details) || (payload && payload.message) || statusFallbackMessage(result.status);
    throw new ApiClientError(message, {
      status: result.status,
      code: (payload && payload.code) || codeFallback(result.status),
      details,
    });
  }

  return payload.data;
}

// ---- Offline handling ------------------------------------------------------

const isUnreachable = (err) =>
  err instanceof ApiClientError && (err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504);

const offlineError = () => new ApiClientError(unreachableMessage(), { status: 0, code: "OFFLINE" });

function cancelledError() {
  return new ApiClientError("", { status: -1, code: "CANCELLED" });
}

function waitForOnlineOrCancel(signal) {
  if (!signal) return waitForOnline();
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(cancelledError());
    signal.addEventListener("abort", () => reject(cancelledError()), { once: true });
    waitForOnline().then(resolve);
  });
}

/**
 * Handles GET requests with offline fallback and background retry.
 */
async function get(path, options = {}) {
  const { wait = true, ...rest } = options;
  if (rest.as === "text") return send(() => request(path, { ...rest, method: "GET" }));
  const cacheable = rest.auth && !rest.full && rest.as !== "text" && isCacheable(path);

  if (!isOffline()) {
    try {
      const data = await request(path, { ...rest, method: "GET" });
      setOnline();
      if (cacheable) saveCached(path, data);
      return data;
    } catch (err) {
      if (err?.code === "CANCELLED") throw err;
      if (!isUnreachable(err)) {
        setOnline();
        throw err;
      }
      setOffline();
    }
  }

  const hit = cacheable ? await readCached(path) : null;
  if (hit) {
    noteSavedData(hit.savedAt);
    if (isOffline()) retryInBackground(path, rest, cacheable);
    return hit.data;
  }
  if (rest.signal?.aborted) throw cancelledError();
  checkNow();
  reportNetworkError(unreachableMessage());
  if (!wait) throw offlineError();
  await waitForOnlineOrCancel(rest.signal);
  return get(path, options);
}

function retryInBackground(path, options, cacheable) {
  request(path, { ...options, method: "GET" })
    .then((data) => {
      if (cacheable) saveCached(path, data);
      setOnline();
    })
    .catch((err) => {
      if (!isUnreachable(err)) setOnline();
    });
}

/**
 * Wraps mutating requests; blocks immediately when offline.
 */
async function send(run) {
  if (isOffline()) {
    reportNetworkError(unreachableMessage());
    checkNow();
    throw offlineError();
  }
  try {
    const result = await run();
    setOnline();
    return result;
  } catch (err) {
    if (err?.code === "CANCELLED") throw err;
    if (isUnreachable(err)) {
      setOffline();
      reportNetworkError(unreachableMessage());
    } else {
      setOnline();
    }
    throw err;
  }
}

/**
 * Checks connectivity before starting uncommitted actions.
 */
export function requireOnline() {
  if (!isOffline()) return true;
  reportNetworkError(unreachableMessage());
  return false;
}

onReconnect(clearNetworkError);
onConnectionChange(() => isOffline() && rewordNetworkError(unreachableMessage()));

export const apiClient = {
  get: (path, options) => get(path, options),
  post: (path, body, options) => send(() => request(path, { ...options, method: "POST", body })),
  patch: (path, body, options) => send(() => request(path, { ...options, method: "PATCH", body })),
  put: (path, body, options) => send(() => request(path, { ...options, method: "PUT", body })),
  delete: (path, options) => send(() => request(path, { ...options, method: "DELETE" })),
  upload: (path, formData, options) => send(() => request(path, { ...options, method: "POST", body: formData })),
  uploadFile: (path, file, options) => send(() => uploadFile(path, file, options)),
};

export { BASE_URL as API_BASE_URL };
