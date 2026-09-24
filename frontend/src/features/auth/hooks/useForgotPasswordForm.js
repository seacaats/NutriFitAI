import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { isValidEmail } from "@/shared/utils/authValidators";
import { useRouter } from "expo-router";
import { useState } from "react";

export function useForgotPasswordForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
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

    setError("");
    setLoading(true);
    try {
      // Always succeeds from the API's point of view (it responds generically
      // whether or not the account exists, to avoid email enumeration). It can
      // still fail on the OTP resend cooldown (429) or a mailer outage (500),
      // both of which surface as ApiClientError messages below
      await apiClient.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      router.push({ pathname: "/verify-reset-password", params: { email: email.trim().toLowerCase() } });
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  function goToLogin() {
    router.replace("/login");
  }

  return { email, setEmail, loading, error, handleSubmit, goToLogin };
}