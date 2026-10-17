import { useOtpInput } from "@/features/auth/hooks/useOtpInput";
import { useResendCooldown } from "@/features/auth/hooks/useResendCooldown";
import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { isValidEmail, validateOtp, validatePassword } from "@/shared/utils/authValidators";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";

export function useForgotPasswordForm() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Prefilled when the user comes back from the code screen via
  // "update your email address"
  const [email, setEmail] = useState(() =>
    (Array.isArray(params.email) ? params.email[0] : params.email) || "",
  );
  const [loading, setLoading] = useState(false);
  // Blocks a double tap before `loading` re-renders, which would email two codes
  const submittingRef = useRef(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!email.trim()) {
      setError("Please enter the email you used to create your account.");
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;
    setError("");
    setLoading(true);
    try {
      // Responds identically whether or not the account exists, to avoid
      // email enumeration. It can still fail on the rate limit (429), which
      // surfaces as an ApiClientError message below
      await apiClient.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      router.push({ pathname: "/verify-reset-password", params: { email: email.trim().toLowerCase() } });
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  // Usually opened from login, so going back keeps the history clean
  function goToLogin() {
    if (router.canGoBack()) router.back();
    else router.replace("/login");
  }

  const dismissError = () => setError("");

  return { email, setEmail, loading, error, dismissError, handleSubmit, goToLogin };
}

/** Password-reset OTP screen state, shared by the web and native screens */
export function useVerifyResetPassword() {
  const router = useRouter();
  const { email } = useLocalSearchParams();
  const otp = useOtpInput(4);
  const resend = useResendCooldown();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify() {
    if (!email) {
      setError("We've lost track of which account you're resetting. Please start again.");
      return;
    }

    const otpError = validateOtp(otp.codeValue, otp.length);
    if (otpError) {
      setError(otpError);
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);
    try {
      // Verifies the OTP and exchanges it for a short-lived reset
      // authorization — the password itself hasn't changed yet
      const data = await apiClient.post("/auth/verify-password-reset", {
        email,
        code: otp.codeValue,
      });

      if (!data?.resetToken) {
        setError("The server didn't return a reset authorization. Please try again.");
        otp.reset();
        return;
      }

      router.replace({ pathname: "/reset-password", params: { email, resetToken: data.resetToken } });
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
      setError(message);
      otp.reset();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!resend.canResend || resending) return;
    if (!email) {
      setError("We've lost track of which account you're resetting. Please start again.");
      return;
    }
    setResending(true);
    setError("");
    setSuccess("");
    try {
      // forgot-password invalidates any active challenge and issues a new
      // one, so it doubles as the resend endpoint for this flow
      const payload = await apiClient.post("/auth/forgot-password", { email }, { full: true });
      // Generic by design on the server, to avoid confirming the account exists
      setSuccess(payload?.message || "If an account exists for this email, a new code has been sent.");
      resend.start();
      otp.reset();
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Couldn't resend the code.";
      setError(message);
    } finally {
      setResending(false);
    }
  }

  /** Back to the email step, prefilled so a typo is a one-character fix */
  function updateEmail() {
    router.replace({ pathname: "/forgot-password", params: { email: email || "" } });
  }

  return {
    email,
    otp,
    error,
    dismissError: () => setError(""),
    success,
    dismissSuccess: () => setSuccess(""),
    loading,
    resending,
    cooldown: resend.remaining,
    handleVerify,
    handleResend,
    updateEmail,
  };
}

/**
 * Last step of forgot-password -> verify-reset-password -> reset-password.
 * Shared by the web and native screens, which differ only in layout
 */
export function useResetPasswordForm() {
  const router = useRouter();
  const { email, resetToken } = useLocalSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleShowPassword = () => setShowPassword((v) => !v);
  const toggleShowConfirmPassword = () => setShowConfirmPassword((v) => !v);
  const dismissError = () => setError("");
  const dismissSuccess = () => setSuccess("");

  async function handleSubmit() {
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (!confirmPassword) {
      setError("Please confirm your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    // The token is a route param, so it's missing on a direct visit or reload
    if (!resetToken) {
      setError("Your reset session has expired. Please start over from Forgot password.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const payload = await apiClient.post("/auth/reset-password", { resetToken, password }, { full: true });
      setSuccess(payload?.message || "Password reset! Redirecting to login...");
      setTimeout(() => router.replace("/login"), 1200);
    } catch (err) {
      // Includes SAME_PASSWORD (400): the token is still good, so the user
      // just picks a different password and resubmits from here
      const message =
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
      setError(message);

      // A rejected token can't be retried from this screen — send the user
      // back to the start of the flow instead of leaving them stuck here
      if (err instanceof ApiClientError && err.status === 401) {
        setTimeout(() => router.replace("/forgot-password"), 1800);
      }
    } finally {
      setLoading(false);
    }
  }

  return {
    email,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    toggleShowPassword,
    showConfirmPassword,
    toggleShowConfirmPassword,
    error,
    dismissError,
    success,
    dismissSuccess,
    loading,
    handleSubmit,
  };
}