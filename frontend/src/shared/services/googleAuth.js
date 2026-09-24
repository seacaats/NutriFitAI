import { API_BASE_URL, apiClient, ApiClientError } from "@/shared/api/apiClient";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

// The cross-window transport lives in utils/authChannel.js; re-exported here so
// existing imports from "@/lib/googleAuth" keep working.
export {
    GOOGLE_AUTH_ACK_TYPE,
    GOOGLE_AUTH_CHANNEL,
    GOOGLE_AUTH_MESSAGE_TYPE,
    listenForGoogleResult,
    publishGoogleResult,
    resetGoogleAuthChannel
} from "@/shared/utils/authChannel";

const CALLBACK_PATH = "google-auth";

/**
 * Error codes that can reach the login screen, from either the backend's
 * `?error=...` redirect param or the popup's own failure paths.
 */
export const GOOGLE_ERROR_MESSAGES = {
  // Sent by controllers/authController.js googleAuthCallback
  google_auth_failed: "Google couldn't complete the sign-in. Please try again.",
  google_email_unverified: "Your Google account's email address isn't verified.",
  // The ACCOUNT (not the Google address) hasn't completed email verification.
  // Handled by routing to the OTP screen rather than shown as a dead end --
  // see the email_not_verified branch in useLoginForm.js. The text is the
  // fallback for any path that surfaces it without routing.
  email_not_verified:
    "Please verify your email before signing in. We'll take you to the verification screen.",
  account_not_found:
    "Your account isn't recorded in our database. Please register first.",
  // Raised by the popup callback screen itself
  missing_exchange_token: "Google didn't return a sign-in token. Please try again.",
  exchange_failed: "We couldn't finish signing you in. Please try again.",
  // Raised by the opener while driving the popup
  popup_blocked: "Your browser blocked the sign-in window. Allow popups for this site and try again.",
  popup_closed: "The Google sign-in window was closed before sign-in finished.",
  no_response: "The sign-in window closed without returning a result. Please try again.",
  timed_out: "Google sign-in took too long to finish. Please try again.",
  cancelled: "Google sign-in was cancelled.",
  channel_unsupported: "This browser can't complete popup sign-in. Please update it or use a different browser.",
  storage_failed: "Signed in, but the session couldn't be saved on this device. Check your browser's storage settings.",
};

/**
 * Resolves the message to show for a Google sign-in failure. A message
 * forwarded from the server (e.g. the exchange endpoint's "Invalid or expired
 * sign-in session") is more specific than anything mapped here, so it wins.
 */
export function googleErrorMessage(code, serverMessage) {
  if (serverMessage) return serverMessage;
  return GOOGLE_ERROR_MESSAGES[code] || "Google sign-in failed. Please try again.";
}

/**
 * Where the backend sends the browser after Google sign-in. Must be listed in
 * the backend's APP_REDIRECT_URIS allowlist.
 * - web: the same-origin /google-auth route (the popup has to share the
 *   opener's origin for postMessage to be accepted)
 * - native: a deep link back into the app, e.g. myapp://google-auth
 */
export function getGoogleRedirectUri() {
  if (Platform.OS === "web") return `${window.location.origin}/${CALLBACK_PATH}`;
  return Linking.createURL(CALLBACK_PATH);
}

export function buildGoogleAuthUrl(redirectUri = getGoogleRedirectUri(), { popup = false } = {}) {
  const params = new URLSearchParams({ redirectUri });
  if (popup) params.set("popup", "1");
  return `${API_BASE_URL}/auth/google?${params.toString()}`;
}

/** Trades the short-lived exchangeToken from the OAuth redirect for a session. */
export function exchangeGoogleToken(exchangeToken) {
  return apiClient.post("/auth/google/exchange", { exchangeToken });
}

/**
 * Native Google sign-in. Opens the backend OAuth flow in an in-app browser
 * session and waits for the redirect back into the app.
 * Resolves with the exchange response ({ accessToken, user }). Throws an
 * ApiClientError with code GOOGLE_CANCELLED if the user dismisses the browser.
 * (Web uses the popup flow in useLoginForm instead.)
 */
export async function signInWithGoogle() {
  const redirectUri = getGoogleRedirectUri();
  const result = await WebBrowser.openAuthSessionAsync(buildGoogleAuthUrl(redirectUri), redirectUri);

  if (result.type === "cancel" || result.type === "dismiss") {
    throw new ApiClientError("Google sign-in was cancelled.", { code: "GOOGLE_CANCELLED" });
  }
  if (result.type !== "success") {
    throw new ApiClientError("Google sign-in failed. Please try again.", { code: "GOOGLE_AUTH_FAILED" });
  }

  const { queryParams } = Linking.parse(result.url);

  if (queryParams?.error) {
    throw new ApiClientError(googleErrorMessage(queryParams.error), { code: "GOOGLE_AUTH_FAILED" });
  }
  if (!queryParams?.exchangeToken) {
    throw new ApiClientError(googleErrorMessage("missing_exchange_token"), { code: "GOOGLE_AUTH_FAILED" });
  }

  return exchangeGoogleToken(queryParams.exchangeToken);
}