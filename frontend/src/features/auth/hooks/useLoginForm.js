import { useOtpInput } from "@/features/auth/hooks/useOtpInput";
import { useResendCooldown } from "@/features/auth/hooks/useResendCooldown";
import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { useAuth } from "@/shared/context/AuthContext";
import { useEnterToSubmit } from "@/shared/hooks/useEnterToSubmit";
import {
  buildGoogleAuthUrl,
  googleErrorMessage,
  mfaFromExchange,
  signInWithGoogle,
  takeGoogleMfa,
} from "@/shared/services/googleAuth";
import { listenForGoogleResult, resetGoogleAuthChannel } from "@/shared/utils/authChannel";
import { setAccessToken } from "@/shared/utils/authStorage";
import { isValidEmail } from "@/shared/utils/formValidators";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";

/** Maximum wait time before timing out an unfinished OAuth popup */
const POPUP_TIMEOUT_MS = 3 * 60 * 1000;

/** Polling interval to detect whether the OAuth popup was closed */
const POPUP_CLOSE_POLL_MS = 400;

/**
 * Grace window after opening the OAuth popup: a window handle severed by COOP
 * reports `closed === true` as soon as the popup navigates cross-origin. A `closed`
 * reading within this window marks the handle as untrusted rather than a user cancellation.
 */
const SEVERANCE_GRACE_MS = 2500;

/** Delay before treating a closed popup as cancelled so in-flight results can land first */
const POPUP_CLOSE_GRACE_MS = 600;

export function useLoginForm() {
  const router = useRouter();
  const params = useLocalSearchParams();
  // Refresh AuthContext after storing a new token so protected layouts reflect the active session
  const { refresh } = useAuth();

  // `from`: "register" when navigated here from the registration screen
  const cameFromRegister = (Array.isArray(params.from) ? params.from[0] : params.from) === "register";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  // Active MFA challenge state: { token, method: "email" | "totp", setupRequired }
  const [mfa, setMfa] = useState(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaNotice, setMfaNotice] = useState("");
  // First-time admin MFA enrollment state ({ secret, qrDataUrl }) and one-time recovery codes
  const [mfaSetup, setMfaSetup] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  // Synchronous submit guard to block duplicate taps before state re-renders
  const submittingRef = useRef(false);
  const resendingRef = useRef(false);
  const pendingSessionRef = useRef(null);
  const otp = useOtpInput(4);
  const resend = useResendCooldown();
  const [resending, setResending] = useState(false);

  const popupRef = useRef(null);
  const stopListeningRef = useRef(null);
  const timeoutRef = useRef(null);
  const pollRef = useRef(null);
  const closeTimerRef = useRef(null);
  const focusHandlerRef = useRef(null);
  const handleTrustedRef = useRef(true);

  // Set when the popup window handle is severed and focus returns without a result
  const [googleNeedsAttention, setGoogleNeedsAttention] = useState(false);
  const settledRef = useRef(false);

  const toggleShowPassword = () => setShowPassword((v) => !v);
  const toggleRememberMe = () => setRememberMe((v) => !v);

  /**
   * Redirects to the registration screen prefilled with the Google email when
   * no verified account exists for that address.
   */
  function goToRegisterFromGoogle(googleEmail) {
    router.replace({
      pathname: "/register",
      params: { email: (googleEmail || "").trim().toLowerCase(), from: "google" },
    });
  }

  // Surface errors returned as route params from a full-page Google OAuth redirect
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
    // Clear error params so Back/reload does not replay them
    router.setParams({ googleError: undefined, googleMessage: undefined, googleEmail: undefined });
  }, [params.googleError, params.googleMessage, params.googleEmail, router]);

  // Clean up OAuth listeners and timers on unmount
  useEffect(() => cleanupGoogleListener, []);

  /** Persists the access token and refreshes AuthContext to complete sign-in */
  async function completeSignIn(data) {
    if (!data?.accessToken) {
      const message = "We couldn't sign you in. Please try again.";
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

    // Refresh /auth/me so AuthContext and the (auth) layout redirect to the signed-in route
    await refresh();
  }

  // Starts the second sign-in step when MFA is required ({ token, method, setupRequired })
  async function beginMfa({ token, method, setupRequired }) {
    // Admin accounts (TOTP MFA) are supported on web only
    if (Platform.OS !== "web" && method === "totp") {
      router.replace({ pathname: "/access-denied", params: { reason: "admin-web-only" } });
      return;
    }
    setMfa({ token, method, setupRequired });
    setMfaCode("");
    setMfaNotice(method === "email" ? "We sent a code to your email." : "");
    if (setupRequired) await loadMfaSetup(token);
  }

  // Resume pending MFA challenge handed off from a full-page Google OAuth callback
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

  // Load the QR code and secret key for first-time admin MFA setup
  async function loadMfaSetup(token) {
    setError("");
    try {
      setMfaSetup(await apiClient.post("/auth/login/mfa/setup", { mfaToken: token }));
    } catch (err) {
      if (err?.code === "MFA_SESSION_EXPIRED") cancelMfa();
      setError(mfaProblem(err, "Couldn't start the setup. Please try again."));
    }
  }

  // Verify the initial authenticator code, display recovery codes, and hold the session until acknowledged
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
      // Request a fresh QR code if the setup secret expired
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
      if (err?.code === "MFA_SESSION_EXPIRED") {
        cancelMfa();
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaResend() {
    if (!resend.canResend || resending || resendingRef.current) return;
    resendingRef.current = true;
    setError("");
    setMfaNotice("");
    setResending(true);
    try {
      await apiClient.post("/auth/login/mfa/resend", { mfaToken: mfa.token });
      otp.reset();
      setMfaNotice("We sent a new code to your email.");
      resend.start();
    } catch (err) {
      if (err?.code === "MFA_SESSION_EXPIRED") cancelMfa();
      setError(mfaProblem(err, "Couldn't resend the code. Try again."));
    } finally {
      resendingRef.current = false;
      setResending(false);
    }
  }

  /** Returns the first validation error for the login fields, or "" if valid */
  function validateLogin() {
    if (!email.trim() && !password) return "Please enter your email and password.";
    if (!email.trim()) return "Please enter your email address.";
    if (!isValidEmail(email)) return "Please enter a valid email address.";
    if (!password) return "Please enter your password.";
    return "";
  }

  async function handleLogin() {
    const validationError = validateLogin();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setError("");
    setLoading(true);

    try {
      const data = await apiClient.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
        rememberMe,
      });

      if (data?.mfaRequired) {
        await beginMfa(mfaFromExchange(data));
        return;
      }

      await completeSignIn(data);
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
      setError(message);
      Alert.alert("Login failed", message);
    } finally {
      submittingRef.current = false;
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

  /** Central handler for OAuth popup failure paths */
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
        if (data?.mfaRequired) {
          await beginMfa(mfaFromExchange(data));
          return;
        }
        await setAccessToken(data.accessToken);
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

    // Popup communicates via BroadcastChannel because Google's COOP headers sever window.opener
    if (typeof BroadcastChannel === "undefined") {
      const message = googleErrorMessage("channel_unsupported");
      setError(message);
      Alert.alert("Google sign-in failed", message);
      return;
    }

    setGoogleLoading(true);

    // Clear any stale result from a previous OAuth attempt
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
        if (data.error === "registration_required") {
          goToRegisterFromGoogle(data.email);
          return;
        }

        const message = googleErrorMessage(data.error, data.message);
        setError(message);
        Alert.alert("Google sign-in failed", message);
        return;
      }

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

      await refresh();
    }

    // Listen for the OAuth result and acknowledge receipt so the popup can close
    stopListeningRef.current = listenForGoogleResult(handleResult);

    // Only trust `popup.closed` after SEVERANCE_GRACE_MS has elapsed; an earlier
    // true reading indicates a COOP-severed window handle rather than a user close
    const openedAt = Date.now();
    handleTrustedRef.current = true;
    setGoogleNeedsAttention(false);

    function popupIsClosed() {
      try {
        return popup.closed;
      } catch {
        return false;
      }
    }

    function noteClosed() {
      if (settledRef.current) return;

      clearInterval(pollRef.current);
      pollRef.current = null;

      if (Date.now() - openedAt < SEVERANCE_GRACE_MS) {
        handleTrustedRef.current = false;
        return;
      }

      // Allow a brief grace period so a result posted just before window close still wins
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = setTimeout(() => {
        failGoogleSignIn("popup_closed");
      }, POPUP_CLOSE_GRACE_MS);
    }

    pollRef.current = setInterval(() => {
      if (settledRef.current) return;
      if (popupIsClosed()) noteClosed();
    }, POPUP_CLOSE_POLL_MS);

    // Detect opener focus return to handle popup closure or prompt when the handle was severed
    function onOpenerFocus() {
      if (settledRef.current) return;
      if (document.visibilityState === "hidden") return;

      if (handleTrustedRef.current && popupIsClosed()) {
        noteClosed();
        return;
      }

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
        // Popup may already be closed or severed
      }
      failGoogleSignIn("timed_out");
    }, POPUP_TIMEOUT_MS);
  }

  /** Cancels an in-progress Google OAuth flow when the popup state cannot be observed */
  function cancelGoogleLogin() {
    if (settledRef.current) return;
    settledRef.current = true;

    try {
      popupRef.current?.close();
    } catch {
      // Ignore errors on severed window handle
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

  // Navigate back if opened from register to avoid stacking duplicate history entries
  function goToRegister() {
    if (cameFromRegister && router.canGoBack()) {
      router.back();
      return;
    }
    router.push({ pathname: "/register", params: { from: "login" } });
  }

  const dismissError = () => setError("");

  // Enter in the email or password field signs in
  const { canSubmit, onSubmitEditing } = useEnterToSubmit({ submit: handleLogin, validate: validateLogin, loading });

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
    canSubmit,
    onSubmitEditing,
    mfa,
    mfaCode,
    setMfaCode,
    otp,
    mfaNotice,
    dismissMfaNotice: () => setMfaNotice(""),
    handleMfaSubmit,
    handleMfaResend,
    resending,
    cooldown: resend.remaining,
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
