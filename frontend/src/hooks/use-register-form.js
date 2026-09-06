import { useRouter } from "expo-router";
import { useState } from "react";


export const GENDERS = ["Male", "Female", "Other"];

export const GOALS = [
  { label: "Lose Weight", value: "lose-weight" },
  { label: "Gain Muscle", value: "gain-muscle" },
  { label: "Maintain Weight", value: "maintain" },
  { label: "Improve Overall Health", value: "healthy" },
];

export function useRegisterForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("");
  const [goal, setGoal] = useState("");
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleShowPassword = () => setShowPassword((v) => !v);
  const toggleShowConfirmPassword = () => setShowConfirmPassword((v) => !v);
  const toggleGoalPicker = () => setGoalPickerOpen((v) => !v);
  const toggleAgreeTerms = () => setAgreeTerms((v) => !v);

  const selectGoal = (label) => {
    setGoal(label);
    setGoalPickerOpen(false);
  };

  const isComplete =
    fullName.trim() &&
    email.trim() &&
    password &&
    confirmPassword &&
    age &&
    height &&
    weight &&
    gender &&
    goal &&
    agreeTerms;

  const handleCreateAccount = () => {
    if (!isComplete) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);

    // api call
    setTimeout(() => {
      setLoading(false);
      router.push({ pathname: "/verify-registration", params: { email } });
    }, 500);
  };

  const goToLogin = () => router.replace("/login");

  return {
    fullName,
    setFullName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    toggleShowPassword,
    showConfirmPassword,
    toggleShowConfirmPassword,
    age,
    setAge,
    height,
    setHeight,
    weight,
    setWeight,
    gender,
    setGender,
    goal,
    goalPickerOpen,
    toggleGoalPicker,
    selectGoal,
    agreeTerms,
    toggleAgreeTerms,
    error,
    loading,
    handleCreateAccount,
    goToLogin,
  };
}