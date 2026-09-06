import { useRouter } from "expo-router";
import { useState } from "react";


export function useForgotPasswordForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = () => {
    if (!email.trim()) return;

    setLoading(true);

    // api call
    setTimeout(() => {
      setLoading(false);
      router.push({ pathname: "/verify-otp", params: { email } });
    }, 500);
  };

  const goToLogin = () => router.replace("/login");

  return { email, setEmail, loading, handleSubmit, goToLogin };
}
