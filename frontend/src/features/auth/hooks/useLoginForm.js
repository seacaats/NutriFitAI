import { ApiClientError, apiClient } from "@/shared/api/apiClient";
import { useAuth } from "@/shared/context/AuthContext";
import { buildGoogleAuthUrl, googleErrorMessage, signInWithGoogle } from "@/shared/services/googleAuth";
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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

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
  const settledRef = useRef(false);

  const toggleShowPassword = () => setShowPassword((v) => !v);
  const toggleRememberMe = () => setRememberMe((v) => !v);

  // The full-page (non-popup) Google redirect hands failures back as route
  // params — surface them instead of dropping the user on a blank login form
  useEffect(() => {
    const code = Array.isArray(params.googleError) ? params.googleError[0] : params.googleError;
    if (!code) return;
    const serverMessage = Array.isArray(params.googleMessage) ? params.googleMessage[0] : params.googleMessage;

    /**
     * Unverified account: route, don't just report
     *
     * Mirrors the EMAIL_NOT_VERIFIED branch of the password submit below, so
     * an unverified user ends up on the same OTP screen whichever way they
     * tried to sign in. Showing the message alone would leave them on the
     * login form with no way forward -- the account exists and the password
     * may be right, so every retry fails identically
     *
     * The email comes back on the redirect precisely so the field can be
     * prefilled here, the same as the password path passes it
     */
    if (code === "email_not_verified") {
      const unverifiedEmail = Array.isArray(params.googleEmail) ? params.googleEmail[0] : params.googleEmail;
      Alert.alert(
        "Email not verified",
        "Please verify your email before signing in. We'll take you to the verification screen.",
      );
      router.push({
        pathname: "/verify-registration",
        params: { email: (unverifiedEmail || email || "").trim().toLowerCase() },
      });
      return;
    }

    setError(googleErrorMessage(code, serverMessage || undefined));
  }, [params.googleError, params.googleMessage, params.googleEmail, router, email]);

  // Tear down timers/listeners if the user navigates away mid sign-in
  useEffect(() => cleanupGoogleListener, []);

  async function handleLogin() {
    if (!email.trim() && !password) {
      setError("Please enter your email and password.");
      Alert.alert("Missing information", "Please enter your email and password.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      Alert.alert("Missing information", "Please enter your email address.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      Alert.alert("Missing information", "Please enter your password.");
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
      // freshly logged-in user before we navigate in
      await refresh();

      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "EMAIL_NOT_VERIFIED") {
        Alert.alert(
          "Email not verified",
          "Please verify your email before logging in. We'll take you to the verification screen.",
        );
        router.push({ pathname: "/verify-registration", params: { email: email.trim().toLowerCase() } });
        return;
      }

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
        await setAccessToken(data.accessToken);
        await refresh();
        router.replace("/dashboard");
      } catch (err) {
        if (err instanceof ApiClientError && err.code === "GOOGLE_CANCELLED") return;
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
        // Popup path, same rule as the full-page redirect above: an
        // unverified account is routed to the OTP screen, not left staring
        // at an error it cannot act on
        if (data.error === "email_not_verified") {
          Alert.alert(
            "Email not verified",
            "Please verify your email before signing in. We'll take you to the verification screen.",
          );
          router.push({
            pathname: "/verify-registration",
            params: { email: (data.email || email || "").trim().toLowerCase() },
          });
          return;
        }

        const message = googleErrorMessage(data.error, data.message);
        setError(message);
        Alert.alert("Google sign-in failed", message);
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

      router.replace("/dashboard");
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

  function goToRegister() {
    router.push("/register");
  }

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
    handleLogin,
    handleGoogleLogin,
    cancelGoogleLogin,
    goToForgotPassword,
    goToRegister,
  };
}