import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import {
  ACTIVITY_LEVELS,
  activityLabelToValue,
  genderLabelToValue, GENDERS, goalLabelToValue, GOALS,
} from "@/shared/constants/profileOptions";
import { isValidEmail, validateOptionalNumber, validatePassword } from "@/shared/utils/authValidators";
import { useRouter } from "expo-router";
import { useState } from "react";

export { ACTIVITY_LEVELS, GENDERS, GOALS };

export function useRegisterForm() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [gender, setGender] = useState("");

  // nutrition/health + goal + consent
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dietPreference, setDietPreference] = useState("");
  const [healthConditions, setHealthConditions] = useState("");
  const [goal, setGoal] = useState(""); // stores the display label, matching the existing screen
  const [goalPickerOpen, setGoalPickerOpen] = useState(false);
  const [activity, setActivity] = useState(""); // display label, mirrors goal
  const [activityPickerOpen, setActivityPickerOpen] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleShowPassword = () => setShowPassword((v) => !v);
  const toggleShowConfirmPassword = () => setShowConfirmPassword((v) => !v);
  const toggleGoalPicker = () => setGoalPickerOpen((v) => !v);
  const toggleActivityPicker = () => setActivityPickerOpen((v) => !v);
  const toggleAgreeTerms = () => setAgreeTerms((v) => !v);
  const selectGoal = (label) => {
    setGoal(label);
    setGoalPickerOpen(false);
  };
  const selectActivity = (label) => {
    setActivity(label);
    setActivityPickerOpen(false);
  };

  /** Mirrors the account-basics half of registerSchema */
  function validateAccount() {

    if (!firstName.trim() && !lastName.trim() && !email.trim() && !password && !confirmPassword) {
      return "Please enter your details.";
    }

    // Bounds mirror registerSchema in the backend's authValidators.js
    if (!firstName.trim()) return "Please enter your first name.";
    if (firstName.trim().length > 75) return "First name must be 75 characters or fewer.";
    // Deliberately NOT required: a mononym is a real name
    if (lastName.trim().length > 75) return "Last name must be 75 characters or fewer.";

    if (!email.trim()) return "Please enter your email.";
    if (!isValidEmail(email)) return "Please enter a valid email address.";
    if (email.trim().length > 255) return "Email must be 255 characters or fewer.";

    // Checked before validatePassword() specifically so an empty password
    // reads as "please enter your password" rather than always surfacing
    // "Password must be at least 8 characters" -- which was misleading for
    // a field the user hadn't typed into at all
    if (!password) return "Please enter your password.";
    const passwordError = validatePassword(password);
    if (passwordError) return passwordError;

    if (!confirmPassword) return "Please confirm your password.";
    if (password !== confirmPassword) return "Passwords do not match.";

    const ageError = validateOptionalNumber(age, { label: "Age", min: 10, max: 120, integer: true });
    if (ageError) return ageError;

    const heightError = validateOptionalNumber(height, { label: "Height", min: 1, max: 300 });
    if (heightError) return heightError;

    const weightError = validateOptionalNumber(weight, { label: "Weight", min: 1, max: 500 });
    if (weightError) return weightError;

    if (gender && !genderLabelToValue(gender)) return "Please choose a valid gender option.";
    return "";
  }

  /** Mirrors registerSchema's dietPreference/healthConditions widths */
  function validateDetails() {
    if (goal && !goalLabelToValue(goal)) return "Please choose a valid fitness goal.";
    if (activity && !activityLabelToValue(activity)) return "Please choose a valid activity level.";
    if (dietPreference.trim().length > 30) return "Diet preference must be 30 characters or fewer.";
    if (healthConditions.trim().length > 2000) return "Health conditions must be 2000 characters or fewer.";
    if (!agreeTerms) return "Please accept the Terms of Service and Privacy Policy.";
    return "";
  }

  /** Advances from step 1 to step 2, only once step 1 is actually valid. */
  function continueToDetails() {
    const validationError = validateAccount();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setDetailsOpen(true);
  }

  /** Back to step 1. Nothing already entered is lost. */
  function backToAccount() {
    setDetailsOpen(false);
    setError("");
  }

  async function handleCreateAccount() {
    // Re-checks step 1 too -- defensive, since nothing prevents step 1 state
    // from having been left invalid if this is ever reachable without going
    // through continueToDetails first
    const validationError = validateAccount() || validateDetails();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setLoading(true);

    try {
      await apiClient.post("/auth/register", {
        firstName: firstName.trim(),
        // Omitted rather than sent empty, so the server stores null instead of
        // an empty string for someone with one name
        lastName: lastName.trim() || undefined,
        email: email.trim().toLowerCase(),
        password,
        age: age ? Number(age) : undefined,
        heightCm: height ? Number(height) : undefined,
        weightKg: weight ? Number(weight) : undefined,
        gender: gender ? genderLabelToValue(gender) : undefined,
        goal: goal ? goalLabelToValue(goal) : undefined,
        activityLevel: activity ? activityLabelToValue(activity) : undefined,
        dietPreference: dietPreference.trim() || undefined,
        healthConditions: healthConditions.trim() || undefined,
        termsAccepted: agreeTerms,
      });

      router.push({ pathname: "/verify-registration", params: { email: email.trim().toLowerCase() } });
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

  function goToTerms() {
    router.push("/terms");
  }

  return {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    /** Read-only, for greetings and summaries */
    fullName: [firstName.trim(), lastName.trim()].filter(Boolean).join(" "),
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

    detailsOpen,
    continueToDetails,
    backToAccount,
    dietPreference,
    setDietPreference,
    healthConditions,
    setHealthConditions,
    goal,
    goalPickerOpen,
    toggleGoalPicker,
    selectGoal,
    activity,
    activityPickerOpen,
    toggleActivityPicker,
    selectActivity,
    agreeTerms,
    toggleAgreeTerms,

    error,
    loading,
    handleCreateAccount,
    goToLogin,
    goToTerms,
  };
}