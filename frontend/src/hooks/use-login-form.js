import { useRouter } from "expo-router";
import { useState } from "react";


export function useLoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleShowPassword = () => setShowPassword((v) => !v);
  const toggleRememberMe = () => setRememberMe((v) => !v);

  const handleLogin = () => {
    setLoading(true);

    // api call
    setTimeout(() => {
      setLoading(false);
      router.replace("/dashboard");
    }, 500);
  };

  const goToRegister = () => router.push("/register");
  const goToForgotPassword = () => router.push("/forgot-password");

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
    handleLogin,
    goToRegister,
    goToForgotPassword,
  };
}
