import { useOtpInput } from "@/features/auth/hooks/useOtpInput";
import { useResendCooldown } from "@/features/auth/hooks/useResendCooldown";
import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import {
  ACTIVITY_OPTIONS,
  activityLabelToValue,
  CUSTOM_OPTION_MAX,
  DIET_PREFERENCES,
  DIET_PREFERENCES_MAX,
  GOAL_OPTIONS,
  goalLabelToValue,
  HEALTH_CONDITIONS,
  healthConditionsFor,
  NO_DIET_PREFERENCE,
  NO_HEALTH_CONDITIONS,
  OTHER_OPTION,
  SEXES,
  sexLabelToValue,
} from "@/shared/constants/profileOptions";
import { useEnterToSubmit } from "@/shared/hooks/useEnterToSubmit";
import {
  AGE_MAX,
  AGE_MIN,
  isValidEmail,
  validateName,
  validateNumber,
  validateOtp,
  validatePassword,
} from "@/shared/utils/formValidators";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

export { ACTIVITY_OPTIONS, DIET_PREFERENCES, GOAL_OPTIONS, HEALTH_CONDITIONS, SEXES };

// Mirrors registerSchema on the backend
const HEALTH_CONDITIONS_MAX = 2000;

function firstParam(value) {
  return Array.isArray(value) ? value[0] : value;
}

/** Resolves a single-select dropdown to the chosen label, or the custom text when "Other" is selected */
function resolveChoice(choice, otherText) {
  if (!choice) return "";
  return choice === OTHER_OPTION ? otherText.trim() : choice;
}

export function useRegisterForm() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Prefilled when redirected from Google sign-in with an unverified or unregistered email
  const [email, setEmail] = useState(() => firstParam(params.email) || "");
  const [notice, setNotice] = useState(() =>
    firstParam(params.from) === "google"
      ? "We couldn't find a verified account for that Google email. Create one below to continue."
      : "",
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [sex, setSex] = useState("");

  // Step 2: dropdowns store display labels; "Other" pairs with a custom text input
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [openPicker, setOpenPicker] = useState(null); // "diet" | "health" | "activity" | "goal" | null
  const [dietPreference, setDietPreference] = useState([]);
  const [dietOther, setDietOther] = useState("");
  const [healthConditions, setHealthConditions] = useState([]);
  const [healthOther, setHealthOther] = useState("");
  const [activity, setActivity] = useState("");
  const [activityOther, setActivityOther] = useState("");
  const [goal, setGoal] = useState("");
  const [goalOther, setGoalOther] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleShowPassword = () => setShowPassword((v) => !v);
  const toggleShowConfirmPassword = () => setShowConfirmPassword((v) => !v);
  const toggleAgreeTerms = () => setAgreeTerms((v) => !v);
  const dismissError = () => setError("");
  const dismissNotice = () => setNotice("");

  // Tapping the active sex pill clears it; drops any health conditions not applicable to the new selection
  const selectSex = (label) => {
    const next = sex === label ? "" : label;
    const allowed = healthConditionsFor(next);
    setSex(next);
    setHealthConditions((current) => current.filter((c) => allowed.includes(c)));
  };

  const togglePicker = (key) => setOpenPicker((current) => (current === key ? null : key));

  function pickSingle(setter, key) {
    return (label) => {
      setter(label);
      setOpenPicker((current) => (current === key ? null : current));
    };
  }

  // Multi-select toggle where `exclusive` ("None", "No Preference") clears other selections
  function multiToggle(setter, exclusive) {
    return (label) => setter((current) => {
      if (label === exclusive) return current.includes(label) ? [] : [label];
      const rest = current.filter((c) => c !== exclusive);
      return rest.includes(label) ? rest.filter((c) => c !== label) : [...rest, label];
    });
  }

  // Health conditions and diet preferences are multi-select and comma-joined on submit
  const toggleHealthCondition = multiToggle(setHealthConditions, NO_HEALTH_CONDITIONS);
  const toggleDietPreference = multiToggle(setDietPreference, NO_DIET_PREFERENCE);

  function resolveMulti(choices, other) {
    return choices
      .map((c) => (c === OTHER_OPTION ? other.trim() : c))
      .filter(Boolean)
      .join(", ");
  }
  const resolvedHealthConditions = () => resolveMulti(healthConditions, healthOther);
  const resolvedDietPreference = () => resolveMulti(dietPreference, dietOther);

  /** Step 1 validation matching registerSchema in backend authValidators.js */
  function validateAccount() {
    if (!firstName.trim() && !lastName.trim() && !email.trim() && !password && !confirmPassword) {
      return "Please enter your details.";
    }

    const firstNameError = validateName(firstName, { label: "First name", required: true });
    if (firstNameError) return firstNameError;
    // Last name is optional to support mononyms
    const lastNameError = validateName(lastName, { label: "Last name" });
    if (lastNameError) return lastNameError;

    if (!email.trim()) return "Please enter your email.";
    if (!isValidEmail(email) || email.trim().length > 255) return "Please enter a valid email address.";

    const passwordError = validatePassword(password);
    if (passwordError) return passwordError;

    if (!confirmPassword) return "Please confirm your password.";
    if (password !== confirmPassword) return "Passwords don't match.";

    return "";
  }

  /** Step 2 (About You) validation; all fields except sex are required */
  function validateDetails() {
    const ageError = validateNumber(age, { label: "Age", min: AGE_MIN, max: AGE_MAX, integer: true, required: true });
    if (ageError) return ageError;

    const heightError = validateNumber(height, { label: "Height", min: 1, max: 300, required: true });
    if (heightError) return heightError;

    const weightError = validateNumber(weight, { label: "Weight", min: 1, max: 500, required: true });
    if (weightError) return weightError;

    if (sex && !sexLabelToValue(sex)) return "Please choose a valid option for sex.";

    if (!goal) return "Please choose your fitness goal.";
    if (!activity) return "Please choose your activity level.";
    if (!dietPreference.length) return "Please choose your diet preference.";
    if (!healthConditions.length) return "Please choose your health conditions, or None.";
    const otherChecks = [
      [activity, activityOther, "activity level"],
      [goal, goalOther, "fitness goal"],
    ];
    for (const [choice, text, label] of otherChecks) {
      if (choice !== OTHER_OPTION) continue;
      if (!text.trim()) return `Please describe your ${label}.`;
      if (text.trim().length > CUSTOM_OPTION_MAX) return `Your ${label} is too long.`;
    }
    if (dietPreference.includes(OTHER_OPTION) && !dietOther.trim()) {
      return "Please describe your diet preference.";
    }
    if (resolvedDietPreference().length > DIET_PREFERENCES_MAX) return "Diet preferences are too long.";
    if (healthConditions.includes(OTHER_OPTION) && !healthOther.trim()) {
      return "Please describe your health condition.";
    }
    if (resolvedHealthConditions().length > HEALTH_CONDITIONS_MAX) return "Health conditions are too long.";
    if (!agreeTerms) return "Please accept the Terms of Service and Privacy Policy.";
    return "";
  }

  /** Validates the active step for Enter-to-submit */
  function validateCurrentStep() {
    return detailsOpen ? validateAccount() || validateDetails() : validateAccount();
  }

  /** Advances from step 1 to step 2 once step 1 is valid */
  function continueToDetails() {
    const validationError = validateAccount();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setDetailsOpen(true);
  }

  /** Returns to step 1 while preserving entered values */
  function backToAccount() {
    setDetailsOpen(false);
    setOpenPicker(null);
    setError("");
  }

  async function handleCreateAccount() {
    const validationError = validateAccount() || validateDetails();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const activityValue = resolveChoice(activity, activityOther);
    const goalValue = resolveChoice(goal, goalOther);

    try {
      // Server responds identically for new, pending, or existing emails to prevent enumeration
      await apiClient.post("/auth/register", {
        firstName: firstName.trim(),
        // Omit empty lastName so the backend stores null rather than an empty string
        lastName: lastName.trim() || undefined,
        email: normalizedEmail,
        password,
        age: Number(age),
        heightCm: Number(height),
        weightKg: Number(weight),
        sex: sex ? sexLabelToValue(sex) : undefined,
        goal: goalLabelToValue(goalValue),
        activityLevel: activityLabelToValue(activityValue),
        dietPreference: resolvedDietPreference(),
        healthConditions: resolvedHealthConditions(),
        termsAccepted: agreeTerms,
      });

      // Reset to step 1 so returning via "update your email address" opens on the email input
      setDetailsOpen(false);
      setOpenPicker(null);
      router.push({ pathname: "/verify-registration", params: { email: normalizedEmail } });
    } catch (err) {
      const message = err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // Navigate back if opened from login to avoid stacking duplicate history entries
  function goToLogin() {
    if (firstParam(params.from) === "login" && router.canGoBack()) {
      router.back();
      return;
    }
    router.push({ pathname: "/login", params: { from: "register" } });
  }

  function goToTerms() {
    router.push("/terms");
  }

  // Fallback destination for Back when history is empty (e.g. after a Google redirect)
  const backTo = ["google", "login"].includes(firstParam(params.from)) ? "/login" : "/";

  // Enter in any field: step 1 continues, step 2 creates the account
  const { canSubmit, onSubmitEditing } = useEnterToSubmit({
    submit: detailsOpen ? handleCreateAccount : continueToDetails,
    validate: validateCurrentStep,
    loading,
  });

  return {
    backTo,
    firstName,
    setFirstName,
    lastName,
    setLastName,
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
    sex,
    selectSex,
    healthOptions: healthConditionsFor(sex),

    detailsOpen,
    continueToDetails,
    backToAccount,
    openPicker,
    togglePicker,
    dietPreference,
    toggleDietPreference,
    dietOther,
    setDietOther,
    healthConditions,
    toggleHealthCondition,
    healthOther,
    setHealthOther,
    activity,
    selectActivity: pickSingle(setActivity, "activity"),
    activityOther,
    setActivityOther,
    goal,
    selectGoal: pickSingle(setGoal, "goal"),
    goalOther,
    setGoalOther,
    agreeTerms,
    toggleAgreeTerms,

    notice,
    dismissNotice,
    error,
    dismissError,
    loading,
    handleCreateAccount,
    canSubmit,
    onSubmitEditing,
    goToLogin,
    goToTerms,
  };
}

/** Registration OTP screen state, shared by the web and native screens */
export function useVerifyRegistration() {
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
      setSuccess("");
      setError("We don't know which account to verify. Please register again.");
      return;
    }

    const otpError = validateOtp(otp.codeValue, otp.length);
    if (otpError) {
      setSuccess("");
      setError(otpError);
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const payload = await apiClient.post(
        "/auth/verify-registration",
        { email: email.toLowerCase(), code: otp.codeValue },
        { full: true },
      );

      setSuccess(payload?.message || "Email verified successfully!");
      setTimeout(() => router.replace("/login"), 1200);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Something went wrong. Please try again.";
      setError(message);
      otp.reset();
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (!resend.canResend || resending) return;
    if (!email) {
      setSuccess("");
      setError("We don't know which email to send the code to. Please register again.");
      return;
    }

    setError("");
    setSuccess("");
    setResending(true);

    try {
      const payload = await apiClient.post(
        "/auth/resend-registration-otp",
        { email: email.toLowerCase() },
        { full: true },
      );
      setSuccess(payload?.message || "If an account exists for this email, a new code has been sent.");
      resend.start();
      otp.reset();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Couldn't resend the code. Try again.";
      setError(message);
    } finally {
      setResending(false);
    }
  }

  /** Returns to the registration form with existing field values intact */
  function updateEmail() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({ pathname: "/register", params: { email: email || "" } });
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
