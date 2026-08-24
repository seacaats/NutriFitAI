import { useRouter } from "expo-router";
import { useState } from "react";

export const GOALS = ["Lose Weight", "Maintain Weight", "Gain Muscle", "Improve Endurance"];

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
  const [gender, setGender] = useState("Male");
  const [goal, setGoal] = useState("");
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggleShowPassword = () => setShowPassword((v) => !v);
  const toggleShowConfirmPassword = () => setShowConfirmPassword((v) => !v);
  const toggleGoalPicker = () => setGoalPickerOpen((v) => !v);

  const selectGoal = (g: string) => {
    setGoal(g);
    setGoalPickerOpen(false);
  };

  const handleCreateAccount = () => {
    setLoading(true);
    //mock register call
    setTimeout(() => {
      setLoading(false);
      router.push({ pathname: "/verify", params: { email } });
    }, 800);
  };

  const goToLogin = () => router.replace("/login");

  return {
    // field values and setters
    fullName,
    setFullName,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    age,
    setAge,
    height,
    setHeight,
    weight,
    setWeight,
    gender,
    setGender,
    goal,

    // visibility toggles
    showPassword,
    toggleShowPassword,
    showConfirmPassword,
    toggleShowConfirmPassword,

    // goals dropdown
    goalPickerOpen,
    toggleGoalPicker,
    selectGoal,

    //submission
    loading,
    handleCreateAccount,
    goToLogin,
  };
}
