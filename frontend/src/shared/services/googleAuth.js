import { API_BASE_URL, apiClient, ApiClientError } from "@/shared/api/apiClient";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

const CALLBACK_PATH = "google-auth";

/**
 * Error codes that can reach the login screen, from either the backend's
 * `?error=...` redirect param or the popup's own failure paths.
 */
const GOOGLE_ERROR_MESSAGES = {
  // Sent by controllers/authController.js googleAuthCallback
  google_auth_failed: "Google couldn't complete the sign-in. Please try again.",
  google_email_unverified: "Your Google account's email address isn't verified.",
  // No verified account for this Google email (unregistered OR registered but
  // unverified -- deliberately indistinguishable). useLoginForm routes this to
  // the register screen; the text is only a fallback
  registration_required:
    "We couldn't find a verified account for that Google email. Please register first.",
  // Raised by the popup callback screen itself
  missing_exchange_token: "Google sign-in didn't go through. Please try again.",
  exchange_failed: "We couldn't finish signing you in. Please try again.",
  // Google went through but the 2FA check couldn't carry on in the original tab
  mfa_undelivered: "Google sign-in worked, but the 2FA check couldn't continue here. Please log in again.",
  // Raised by the opener while driving the popup
  popup_blocked: "Your browser blocked the sign-in window. Allow popups for this site and try again.",
  popup_closed: "The Google sign-in window was closed before sign-in finished.",
  no_response: "The sign-in window closed before finishing. Please try again.",
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
function getGoogleRedirectUri() {
  if (Platform.OS === "web") return `${window.location.origin}/${CALLBACK_PATH}`;
  return Linking.createURL(CALLBACK_PATH);
}

export function buildGoogleAuthUrl(redirectUri = getGoogleRedirectUri(), { popup = false } = {}) {
  const params = new URLSearchParams({ redirectUri });
  if (popup) params.set("popup", "1");
  return `${API_BASE_URL}/auth/google?${params.toString()}`;
}

/**
 * Trades the short-lived exchangeToken from the OAuth redirect for a session, or,
 * when 2FA is on (always for admins), for the challenge that
 * comes next ({ mfaRequired, mfaToken, mfaMethod, mfaSetupRequired }).
 */
export function exchangeGoogleToken(exchangeToken) {
  return apiClient.post("/auth/google/exchange", { exchangeToken });
}

/** The second-step state of an exchange response, in the shape the login form takes */
export function mfaFromExchange(data) {
  return { token: data.mfaToken, method: data.mfaMethod, setupRequired: Boolean(data.mfaSetupRequired) };
}

// A full-page Google sign-in that still needs its second step. Held in memory for
// the login screen to pick up, so the token never sits in the address bar
let pendingGoogleMfa = null;
export const stashGoogleMfa = (mfa) => { pendingGoogleMfa = mfa; };
export function takeGoogleMfa() {
  const mfa = pendingGoogleMfa;
  pendingGoogleMfa = null;
  return mfa;
}

// True while the phone's Google sign-in is open (the browser backgrounds the
// app), so returning from it isn't treated as reopening the app
let googleSignInOpen = false;
export const isGoogleSignInOpen = () => googleSignInOpen;

/**
 * Native Google sign-in. Opens the backend OAuth flow in an in-app browser
 * session and waits for the redirect back into the app.
 * Resolves with the exchange response ({ accessToken, user }, or the second-step
 * challenge, see exchangeGoogleToken). Throws an
 * ApiClientError with code GOOGLE_CANCELLED if the user dismisses the browser.
 * (Web uses the popup flow in useLoginForm instead.)
 */
export async function signInWithGoogle() {
  googleSignInOpen = true;
  try {
    return await runGoogleSignIn();
  } finally {
    // A beat later: the app's resume event can land after this settles
    setTimeout(() => { googleSignInOpen = false; }, 1500);
  }
}

async function runGoogleSignIn() {
  const redirectUri = getGoogleRedirectUri();
  const result = await WebBrowser.openAuthSessionAsync(buildGoogleAuthUrl(redirectUri), redirectUri);

  if (result.type === "cancel" || result.type === "dismiss") {
    throw new ApiClientError("Google sign-in was cancelled.", { code: "GOOGLE_CANCELLED" });
  }
  if (result.type !== "success") {
    throw new ApiClientError("Google sign-in failed. Please try again.", { code: "GOOGLE_AUTH_FAILED" });
  }

  const { queryParams } = Linking.parse(result.url);

  if (queryParams?.error === "registration_required") {
    throw new ApiClientError(googleErrorMessage("registration_required"), {
      code: "REGISTRATION_REQUIRED",
      details: { email: queryParams.email || "" },
    });
  }
  if (queryParams?.error) {
    throw new ApiClientError(googleErrorMessage(queryParams.error), { code: "GOOGLE_AUTH_FAILED" });
  }
  if (!queryParams?.exchangeToken) {
    throw new ApiClientError(googleErrorMessage("missing_exchange_token"), { code: "GOOGLE_AUTH_FAILED" });
  }

  return exchangeGoogleToken(queryParams.exchangeToken);
}