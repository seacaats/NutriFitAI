import { useOtpInput } from "@/features/auth/hooks/useOtpInput";
import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { useAuth } from "@/shared/context/AuthContext";
import { useKeepOnResume } from "@/shared/hooks/useLandingOnResume";
import {
  buildGoogleAuthUrl,
  googleErrorMessage,
  mfaFromExchange,
  signInWithGoogle,
  takeGoogleMfa,
} from "@/shared/services/googleAuth";
import { listenForGoogleResult, resetGoogleAuthChannel } from "@/shared/utils/authChannel";
import { setAccessToken } from "@/shared/utils/authStorage";
import { isValidEmail } from "@/shared/utils/authValidators";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

/** Give up on the popup if the user never finishes  */
const POPUP_TIMEOUT_MS = 3 * 60 * 1000;

/** How often to check whether the user closed the popup */
const POPUP_CLOSE_POLL_MS = 400;

/**
 * A window handle severed by COOP reports `closed === true` the moment the
 * popup navigates away from this origin -- long before a person could have
 * read the consent screen, let alone signed in and closed it. So a `closed`
 * reading inside this window is treated as evidence the handle is unusable,
 * not as a cancellation. Anything after it is a real close
 */
const SEVERANCE_GRACE_MS = 2500;

/** Let an in-flight result land before calling a closed popup a cancellation */
const POPUP_CLOSE_GRACE_MS = 600;

export function useLoginForm() {
  const router = useRouter();
  const params = useLocalSearchParams();
  // AuthContext's session load runs once on app mount, so a fresh login
  // must explicitly refresh it before navigating in -- otherwise
  // DashboardLayout (and anything else reading useAuth()) renders the
  // stale pre-login session
  const { refresh } = useAuth();

  // `from`: "register" when the user came here from the register screen.
  // (`next`, the page to return to, is read by the (auth) layout)
  const cameFromRegister = (Array.isArray(params.from) ? params.from[0] : params.from) === "register";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  // Set when the password was right but two-factor is on: { token, method, setupRequired }
  // method is "email" (regular users) or "totp" (admins, authenticator app).
  // setupRequired: an admin's first sign-in, the app isn't scanned in yet
  const [mfa, setMfa] = useState(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaNotice, setMfaNotice] = useState("");
  // First sign-in of an admin: the QR code to scan ({ secret, qrDataUrl }), then
  // the recovery codes. The session itself is held back until they're saved
  const [mfaSetup, setMfaSetup] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const pendingSessionRef = useRef(null);
  // The emailed code, entered in boxes like the other code screens
  const otp = useOtpInput(4);

  const popupRef = useRef(null);
  const stopListeningRef = useRef(null);
  const timeoutRef = useRef(null);
  const pollRef = useRef(null);
  const closeTimerRef = useRef(null);
  const focusHandlerRef = useRef(null);
  const handleTrustedRef = useRef(true);

  // True only when the popup's state became unobservable, so the screen can
  // ask the user rather than leaving the button spinning
  const [googleNeedsAttention, setGoogleNeedsAttention] = useState(false);
  // Something typed: coming back to the app keeps it
  useKeepOnResume(Boolean(email || password));
  const settledRef = useRef(false);

  const toggleShowPassword = () => setShowPassword((v) => !v);
  const toggleRememberMe = () => setRememberMe((v) => !v);

  /**
   * Google found no verified account for this address (not registered, or
   * registered but never verified -- the server doesn't say which). Either way
   * the way forward is the register screen, prefilled with the Google email.
   * Re-registering an unverified address simply sends it a fresh code.
   * (The redirect-param effect below inlines the same navigation so its
   * dependency list stays honest)
   */
  function goToRegisterFromGoogle(googleEmail) {
    router.replace({
      pathname: "/register",
      params: { email: (googleEmail || "").trim().toLowerCase(), from: "google" },
    });
  }

  // The full-page (non-popup) Google redirect hands failures back as route
  // params — surface them instead of dropping the user on a blank login form
  useEffect(() => {
    const code = Array.isArray(params.googleError) ? params.googleError[0] : params.googleError;
    if (!code) return;
    const serverMessage = Array.isArray(params.googleMessage) ? params.googleMessage[0] : params.googleMessage;

    if (code === "registration_required") {
      const googleEmail = Array.isArray(params.googleEmail) ? params.googleEmail[0] : params.googleEmail;
      router.replace({
        pathname: "/register",
        params: { email: (googleEmail || "").trim().toLowerCase(), from: "google" },
      });
      return;
    }

    setError(googleErrorMessage(code, serverMessage || undefined));
    // Shown once, then dropped from the address so Back/reload/logout can't replay it
    router.setParams({ googleError: undefined, googleMessage: undefined, googleEmail: undefined });
  }, [params.googleError, params.googleMessage, params.googleEmail, router]);

  // Tear down timers/listeners if the user navigates away mid sign-in
  useEffect(() => cleanupGoogleListener, []);

  /** Stores the session from a finished sign-in (password, or password + code) */
  async function completeSignIn(data) {
    if (!data?.accessToken) {
      const message = "Sign-in didn't return a session. Please try again.";
      setError(message);
      Alert.alert("Login failed", message);
      return;
    }

    try {
      await setAccessToken(data.accessToken);
    } catch {
      const message = "Signed in, but the session couldn't be saved on this device. Check your storage settings.";
      setError(message);
      Alert.alert("Login failed", message);
      return;
    }

    // Re-fetch /auth/me now that a new token is stored, so AuthContext
    // (and anything reading useAuth(), like DashboardLayout) reflects the
    // freshly logged-in user
    // Signed in now: the (auth) layout sees it and takes them in (to `next`
    // or their home). Navigating here too replaced the onboarding the
    // dashboard had just opened
    await refresh();
  }

  // The first step went through (password or Google) but a second one is needed before
  // there's a session. { token, method, setupRequired }
  async function beginMfa({ token, method, setupRequired }) {
    // Admins and superadmins (the authenticator-app method) are web only: on a phone
    // there's no code prompt and no QR setup, just the screen saying so. Nothing was
    // stored, so there's no session to clear
    if (Platform.OS !== "web" && method === "totp") {
      router.replace({ pathname: "/access-denied", params: { reason: "admin-web-only" } });
      return;
    }
    setMfa({ token, method, setupRequired });
    setMfaCode("");
    setMfaNotice(method === "email" ? "We sent a code to your email." : "");
    if (setupRequired) await loadMfaSetup(token);
  }

  // A full-page Google sign-in lands here from the callback screen with its second step pending
  useEffect(() => {
    const pending = takeGoogleMfa();
    if (pending) beginMfa(pending);
  }, []);

  const mfaProblem = (err, fallback) => (err instanceof ApiClientError ? err.message : fallback);

  function cancelMfa() {
    setMfa(null);
    setMfaCode("");
    setMfaSetup(null);
    setRecoveryCodes(null);
    pendingSessionRef.current = null;
    otp.reset();
    setMfaNotice("");
    setError("");
    setPassword("");
  }

  // The QR code and key for the first sign-in of an admin
  async function loadMfaSetup(token) {
    setError("");
    try {
      setMfaSetup(await apiClient.post("/auth/login/mfa/setup", { mfaToken: token }));
    } catch (err) {
      if (err?.code === "MFA_SESSION_EXPIRED") cancelMfa();
      setError(mfaProblem(err, "Couldn't start the setup. Please try again."));
    }
  }

  // First code from the app: finishes the setup and signs in. The recovery codes
  // are shown before the session is stored, which would take them off this screen
  async function handleMfaEnable() {
    const code = mfaCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await apiClient.post("/auth/login/mfa/enable", { mfaToken: mfa.token, code });
      pendingSessionRef.current = data;
      setRecoveryCodes(data.recoveryCodes || []);
      setMfaSetup(null);
      setMfaCode("");
    } catch (err) {
      if (err?.code === "MFA_SESSION_EXPIRED") cancelMfa();
      // The QR code timed out: a fresh one replaces it
      if (err?.code === "MFA_SETUP_EXPIRED") loadMfaSetup(mfa.token);
      setError(mfaProblem(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function finishMfaSetup() {
    const session = pendingSessionRef.current;
    pendingSessionRef.current = null;
    setRecoveryCodes(null);
    setLoading(true);
    try {
      await completeSignIn(session);
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit() {
    if (mfa.setupRequired) {
      await handleMfaEnable();
      return;
    }
    const byEmail = mfa.method === "email";
    const code = byEmail ? otp.codeValue : mfaCode.trim();
    if (byEmail ? !otp.isComplete : !code) {
      setError(byEmail ? "Please enter the code we emailed you." : "Please enter the code from your authenticator app.");
      return;
    }
    setError("");
    setMfaNotice("");
    setLoading(true);
    try {
      const data = await apiClient.post("/auth/login/mfa", { mfaToken: mfa.token, code });
      await completeSignIn(data);
    } catch (err) {
      const message = mfaProblem(err, "Something went wrong. Please try again.");
      // The challenge ran out or was invalidated: start over from the password
      if (err?.code === "MFA_SESSION_EXPIRED") {
        cancelMfa();
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaResend() {
    setError("");
    setMfaNotice("");
    try {
      await apiClient.post("/auth/login/mfa/resend", { mfaToken: mfa.token });
      otp.reset();
      setMfaNotice("We sent a new code to your email.");
    } catch (err) {
      if (err?.code === "MFA_SESSION_EXPIRED") cancelMfa();
      setError(mfaProblem(err, "Couldn't resend the code. Try again."));
    }
  }

  async function handleLogin() {
    if (!email.trim() && !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = await apiClient.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
        rememberMe,
      });

      // Right password, but a second step is needed before there's a session
      if (data?.mfaRequired) {
        await beginMfa(mfaFromExchange(data));
        return;
      }

      await completeSignIn(data);
    } catch (err) {
      // Unknown, unverified, and wrong-password all come back as the same
      // "Invalid email or password" from the server, by design
      const message = err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
      setError(message);
      Alert.alert("Login failed", message);
    } finally {
      setLoading(false);
    }
  }

  function cleanupGoogleListener() {
    if (stopListeningRef.current) {
      stopListeningRef.current();
      stopListeningRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (focusHandlerRef.current) {
      window.removeEventListener("focus", focusHandlerRef.current);
      document.removeEventListener("visibilitychange", focusHandlerRef.current);
      focusHandlerRef.current = null;
    }
  }

  /** Single exit point for every popup failure path, so none of them can end silently */
  function failGoogleSignIn(code, serverMessage) {
    if (settledRef.current) return;
    settledRef.current = true;
    cleanupGoogleListener();
    setGoogleLoading(false);
    setGoogleNeedsAttention(false);

    const message = googleErrorMessage(code, serverMessage);
    setError(message);
    Alert.alert("Google sign-in failed", message);
  }

  async function handleGoogleLogin() {
    setError("");

    if (Platform.OS !== "web") {
      setGoogleLoading(true);
      try {
        const data = await signInWithGoogle();
        // Same second step as after a password
        if (data?.mfaRequired) {
          await beginMfa(mfaFromExchange(data));
          return;
        }
        await setAccessToken(data.accessToken);
        // Signed in now: the (auth) layout sees it and takes them in (to `next`
        // or their home). Navigating here too replaced the onboarding the
        // dashboard had just opened
        await refresh();
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "GOOGLE_CANCELLED") return;
        if (err instanceof ApiClientError && err.code === "REGISTRATION_REQUIRED") {
          goToRegisterFromGoogle(err.details?.email);
          return;
        }
        const message = err instanceof ApiClientError ? err.message : "Google sign-in failed. Please try again.";
        setError(message);
        Alert.alert("Google sign-in failed", message);
      } finally {
        setGoogleLoading(false);
      }
      return;
    }

    // The popup reports back over BroadcastChannel because Google's
    // Cross-Origin-Opener-Policy severs window.opener during the round trip
    if (typeof BroadcastChannel === "undefined") {
      const message = googleErrorMessage("channel_unsupported");
      setError(message);
      Alert.alert("Google sign-in failed", message);
      return;
    }

    setGoogleLoading(true);

    // Drop anything left in storage by a previous, abandoned attempt so it
    // can't be mistaken for this one's result
    resetGoogleAuthChannel();

    const authUrl = buildGoogleAuthUrl(undefined, { popup: true });

    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      "google-oauth",
      `width=${width},height=${height},left=${left},top=${top}`,
    );
    popupRef.current = popup;

    if (!popup) {
      setGoogleLoading(false);
      const message = googleErrorMessage("popup_blocked");
      setError(message);
      Alert.alert("Popup blocked", message);
      return;
    }

    settledRef.current = false;

    async function handleResult(data) {
      if (settledRef.current) return;
      settledRef.current = true;

      cleanupGoogleListener();
      setGoogleLoading(false);

      if (!data.success) {
        // Popup path, same rule as the full-page redirect above
        if (data.error === "registration_required") {
          goToRegisterFromGoogle(data.email);
          return;
        }

        const message = googleErrorMessage(data.error, data.message);
        setError(message);
        Alert.alert("Google sign-in failed", message);
        return;
      }

      // Same second step as after a password
      if (data.mfa) {
        await beginMfa(data.mfa);
        return;
      }

      if (!data.accessToken) {
        const message = googleErrorMessage("exchange_failed");
        setError(message);
        Alert.alert("Google sign-in failed", message);
        return;
      }

      try {
        await setAccessToken(data.accessToken);
      } catch {
        const message = googleErrorMessage("storage_failed");
        setError(message);
        Alert.alert("Google sign-in failed", message);
        return;
      }

      // Signed in now: the (auth) layout sees it and takes them in (to `next`
      // or their home). Navigating here too replaced the onboarding the
      // dashboard had just opened
      await refresh();
    }

    // listenForGoogleResult acks on our behalf over every transport, so the
    // popup can close as soon as the result has actually landed here
    stopListeningRef.current = listenForGoogleResult(handleResult);

    // Detecting a user-closed popup is awkward because the window handle is
    // not always trustworthy: if any document in the OAuth round trip opts out
    // of sharing a browsing context group, the browser swaps the handle for a
    // stub whose `closed` is permanently true, and polling it naively cancels
    // the sign-in about a second after the popup opens
    //
    // So `closed` is believed only once enough time has passed that it cannot
    // be the stub (SEVERANCE_GRACE_MS). An early reading marks the handle
    // untrusted and stops the polling
    const openedAt = Date.now();
    handleTrustedRef.current = true;
    setGoogleNeedsAttention(false);

    function popupIsClosed() {
      try {
        return popup.closed;
      } catch {
        // Cross-origin access on a severed handle: unknown, not closed
        return false;
      }
    }

    function noteClosed() {
      if (settledRef.current) return;

      clearInterval(pollRef.current);
      pollRef.current = null;

      if (Date.now() - openedAt < SEVERANCE_GRACE_MS) {
        // Too early to be a real close, so the handle is a severed stub
        handleTrustedRef.current = false;
        return;
      }

      // Short grace so a result posted microseconds before the window died
      // still wins over the cancellation
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        failGoogleSignIn("popup_closed");
      }, POPUP_CLOSE_GRACE_MS);
    }

    pollRef.current = setInterval(() => {
      if (settledRef.current) return;
      if (popupIsClosed()) noteClosed();
    }, POPUP_CLOSE_POLL_MS);

    // Closing the popup hands focus straight back to this window, which is a
    // faster and more reliable signal than waiting for the next poll tick. It
    // also covers the case where polling was switched off above
    function onOpenerFocus() {
      if (settledRef.current) return;
      if (document.visibilityState === "hidden") return;

      if (handleTrustedRef.current && popupIsClosed()) {
        noteClosed();
        return;
      }

      // The handle is a stub, so whether the popup is still open is genuinely
      // unknowable from here. The user is looking at this tab again, so ask
      // instead of spinning indefinitely
      if (!handleTrustedRef.current) {
        setGoogleNeedsAttention(true);
      }
    }

    focusHandlerRef.current = onOpenerFocus;
    window.addEventListener("focus", onOpenerFocus);
    document.addEventListener("visibilitychange", onOpenerFocus);

    timeoutRef.current = setTimeout(() => {
      try {
        popupRef.current?.close();
      } catch {
        // Popup may already be gone, or the handle may be a severed stub
      }
      failGoogleSignIn("timed_out");
    }, POPUP_TIMEOUT_MS);
  }

  /** User-driven escape hatch, since the popup's state can't be observed */
  function cancelGoogleLogin() {
    if (settledRef.current) return;
    settledRef.current = true;

    try {
      popupRef.current?.close();
    } catch {
      // Severed handle — the user closes the window themselves
    }

    cleanupGoogleListener();
    resetGoogleAuthChannel();
    setGoogleLoading(false);
    setGoogleNeedsAttention(false);
    setError(googleErrorMessage("cancelled"));
  }

  function goToForgotPassword() {
    router.push("/forgot-password");
  }

  // Back to the register screen if that's where they came from, so switching
  // between the two doesn't keep stacking screens on the history
  function goToRegister() {
    if (cameFromRegister && router.canGoBack()) {
      router.back();
      return;
    }
    router.push({ pathname: "/register", params: { from: "login" } });
  }

  const dismissError = () => setError("");

  return {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    toggleShowPassword,
    rememberMe,
    toggleRememberMe,
    loading,
    googleLoading,
    googleNeedsAttention,
    error,
    dismissError,
    handleLogin,
    mfa,
    mfaCode,
    setMfaCode,
    otp,
    mfaNotice,
    dismissMfaNotice: () => setMfaNotice(""),
    handleMfaSubmit,
    handleMfaResend,
    mfaSetup,
    recoveryCodes,
    finishMfaSetup,
    cancelMfa,
    handleGoogleLogin,
    cancelGoogleLogin,
    goToForgotPassword,
    goToRegister,
  };
}