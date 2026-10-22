import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { NO_WORKOUT_PREFS, weightTargetProblem } from "@/shared/constants/goalOptions";
import {
  activityLabelToValue,
  activityValueToLabel,
  CUSTOM_OPTION_MAX,
  DIET_PREFERENCES_MAX,
  goalLabelToValue,
  goalValueToLabel,
  pruneHealthConditions,
  sexLabelToValue,
  sexValueToLabel,
} from "@/shared/constants/profileOptions";
import { useAuth } from "@/shared/context/AuthContext";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { resolveMediaUrl } from "@/shared/services/mediaUrl";
import { AGE_MAX, AGE_MIN, isValidEmail, validateName, validateNumber } from "@/shared/utils/formValidators";
import { IMAGE_MAX_BYTES_STANDARD, validateImageFile } from "@/shared/utils/imageValidators";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

/**
 * Backs both profile screens (web and native) so the two stay in step: one
 * definition of what is editable, how it's validated, and how it's saved.
 *
 * Only changed fields are sent. The PATCH endpoint treats an absent key as
 * "leave alone" and an explicit null as "clear", so sending the whole form
 * every time would overwrite fields the user never touched -- including ones
 * this screen doesn't show.
 */

const EMPTY = {
  firstName: "",
  lastName: "",
  email: "",
  age: "",
  sex: "",
  height: "",
  weight: "",
  goal: "",
  activity: "",
  dietPreference: "",
  healthConditions: "",
  targetWeight: "",
  weeklyPace: "",
  workoutPrefs: NO_WORKOUT_PREFS,
};

function toForm(data) {
  if (!data) return EMPTY;
  return {
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    email: data.email || "",
    age: data.age ?? "",
    sex: sexValueToLabel(data.sex) || "",
    height: data.heightCm ?? "",
    weight: data.weightKg ?? "",
    goal: goalValueToLabel(data.fitnessGoal) || "",
    activity: activityValueToLabel(data.activityLevel) || "",
    dietPreference: data.dietPreference || "",
    healthConditions: data.healthConditions || "",
    targetWeight: data.targetWeightKg ?? "",
    weeklyPace: data.weeklyPaceKg ?? "",
    workoutPrefs: data.workoutPrefs || NO_WORKOUT_PREFS,
  };
}

/** "" and null both mean "clear this"; numbers are sent as numbers */
function numberOrNull(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// identityOnly: name and email are all the screen shows (admins), so the body,
// goal and diet fields aren't required to save
export function useProfileForm({ identityOnly = false } = {}) {
  const { refresh: refreshAuth } = useAuth();
  const [serverData, setServerData] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const savedTimer = useRef(null);
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiClient.get("/profile", { auth: true });
      setServerData(data);
      setForm(toForm(data));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't load your profile.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = useCallback((name, value) => {
    // A new sex drops the conditions that don't apply to it
    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === "sex" && { healthConditions: pruneHealthConditions(current.healthConditions, value) }),
    }));
    setSaved(false);
    setError("");
  }, []);

  const startEditing = useCallback(() => {
    setEditing(true);
    setSaved(false);
    setError("");
  }, []);

  /** Discards edits and restores whatever the server last confirmed */
  const cancelEditing = useCallback(() => {
    setForm(toForm(serverData));
    setPendingAvatar(null);
    setEditing(false);
    setError("");
  }, [serverData]);

  function validate() {
    // Same required fields as registration: only last name and sex can be blank
    const firstNameError = validateName(form.firstName, { label: "First name", required: true });
    if (firstNameError) return firstNameError;
    const lastNameError = validateName(form.lastName, { label: "Last name" });
    if (lastNameError) return lastNameError;
    if (form.email && !isValidEmail(form.email)) {
      return "Please enter a valid email address.";
    }
    if (identityOnly) return "";
    // Required: an age can be changed but not cleared
    const ageError = validateNumber(form.age, { label: "Age", min: AGE_MIN, max: AGE_MAX, integer: true, required: true });
    if (ageError) return ageError;
    const heightError = validateNumber(form.height, { label: "Height", min: 1, max: 300, required: true });
    if (heightError) return heightError;
    if (!String(form.goal || "").trim()) return "Please choose your fitness goal.";
    if (!String(form.activity || "").trim()) return "Please choose your activity level.";
    if (!String(form.dietPreference || "").trim()) return "Please choose your diet preference.";
    if (!String(form.healthConditions || "").trim()) return "Please choose your health conditions, or None.";
    // Custom "Other" text shares the backend's 50-char cap
    if (String(form.goal || "").trim().length > CUSTOM_OPTION_MAX) return "Fitness goal is too long.";
    if (String(form.activity || "").trim().length > CUSTOM_OPTION_MAX) return "Activity level is too long.";
    if (String(form.dietPreference || "").trim().length > DIET_PREFERENCES_MAX) return "Diet preferences are too long.";
    if (String(form.healthConditions || "").trim().length > 2000) return "Health conditions are too long.";
    const weightError = validateNumber(form.weight, { label: "Weight", min: 1, max: 500, required: true });
    if (weightError) return weightError;
    // Optional, unlike the fields above
    const targetError = weightTargetProblem(form.targetWeight, form.weeklyPace);
    if (targetError) return targetError;
    return "";
  }

  /** Builds the minimal patch: only fields whose value actually moved */
  function buildPatch() {
    const original = toForm(serverData);
    const patch = {};

    if (form.firstName.trim() !== original.firstName) patch.firstName = form.firstName.trim() || null;
    if (form.lastName.trim() !== original.lastName) patch.lastName = form.lastName.trim() || null;
    if (String(form.age) !== String(original.age)) patch.age = numberOrNull(form.age);
    if (form.sex !== original.sex) patch.sex = sexLabelToValue(form.sex);
    if (String(form.height) !== String(original.height)) patch.heightCm = numberOrNull(form.height);
    if (form.goal !== original.goal) patch.fitnessGoal = goalLabelToValue(form.goal);
    if (form.activity !== original.activity) patch.activityLevel = activityLabelToValue(form.activity);
    if (form.dietPreference.trim() !== original.dietPreference) {
      patch.dietPreference = form.dietPreference.trim() || null;
    }
    if (form.healthConditions.trim() !== original.healthConditions) {
      patch.healthConditions = form.healthConditions.trim() || null;
    }
    if (String(form.targetWeight) !== String(original.targetWeight)) patch.targetWeightKg = numberOrNull(form.targetWeight);
    if (String(form.weeklyPace) !== String(original.weeklyPace)) patch.weeklyPaceKg = numberOrNull(form.weeklyPace);
    // Sent whole, like the API wants it
    if (JSON.stringify(form.workoutPrefs) !== JSON.stringify(original.workoutPrefs)) patch.workoutPrefs = form.workoutPrefs;

    // weightKg is append-only server-side (a new weight_logs row), so it is
    // only sent when it changed -- never as a no-op rewrite of the same value
    const weight = numberOrNull(form.weight);
    if (weight !== null && String(form.weight) !== String(original.weight)) {
      patch.weightKg = weight;
    }

    return patch;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return false;
    }

    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return true;
    }

    setSaving(true);
    setError("");
    try {
      const data = await apiClient.patch("/profile", patch, { auth: true });
      setServerData(data);
      // The topbar and menus read name and photo from AuthContext, not this form
      refreshAuth();
      setForm(toForm(data));
      setEditing(false);
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
      return true;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't save your profile. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const [avatarUploading, setAvatarUploading] = useState(false);

  // A picked-but-not-yet-uploaded image. Holding it here means the choice is
  // reversible: nothing reaches the server, and nothing is written to
  // user_profiles, until the user confirms
  const [pendingAvatar, setPendingAvatar] = useState(null);

  /**
   * What the avatar should display right now: the staged pick if there is one,
   * otherwise whatever the server last confirmed
   */
  // serverData.avatarUrl is a root-relative path from the server; a pending
  // local pick already carries a usable file:// or blob: uri. resolveMediaUrl
  // passes absolutes through untouched, so it is safe on either branch
  const avatarPreviewUri = pendingAvatar?.uri || resolveMediaUrl(serverData?.avatarUrl) || null;
  const avatarDirty = Boolean(pendingAvatar);

  /** Opens the library and stages the result. Does NOT upload */
  async function changeAvatar() {
    setError("");

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is needed to change your picture.");
      return false;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (picked.canceled || !picked.assets?.length) return false;

    const asset = picked.assets[0];
    const validationError = validateImageFile(asset, { maxBytes: IMAGE_MAX_BYTES_STANDARD });
    if (validationError) {
      setError(validationError);
      return false;
    }

    setPendingAvatar({
      uri: asset.uri,
      name: asset.fileName || "avatar.jpg",
      type: asset.mimeType || "image/jpeg",
    });
    return true;
  }

  /** Discards the staged pick and falls back to the stored avatar */
  function undoAvatar() {
    setPendingAvatar(null);
    setError("");
  }

  /** Uploads the staged pick. Only here does anything hit the database */
  async function saveAvatar() {
    if (!pendingAvatar) return false;

    const validationError = validateImageFile(pendingAvatar, { maxBytes: IMAGE_MAX_BYTES_STANDARD });
    if (validationError) {
      setError(validationError);
      return false;
    }

    setAvatarUploading(true);
    setError("");
    try {
      const formData = new FormData();

      if (Platform.OS === "web") {
        // The picker hands back a blob: URL on web, which the server can't
        // read -- it has to be fetched back into real bytes first
        const blob = await (await fetch(pendingAvatar.uri)).blob();
        const blobError = validateImageFile(
          { type: blob.type, size: blob.size, name: pendingAvatar.name },
          { maxBytes: IMAGE_MAX_BYTES_STANDARD }
        );
        if (blobError) {
          setError(blobError);
          return false;
        }
        formData.append("avatar", blob, pendingAvatar.name);
      } else {
        formData.append("avatar", {
          uri: pendingAvatar.uri,
          name: pendingAvatar.name,
          type: pendingAvatar.type,
        });
      }

      const data = await apiClient.upload("/profile/avatar", formData, { auth: true });
      setServerData(data);
      // The topbar and menus read name and photo from AuthContext, not this form
      refreshAuth();
      setForm(toForm(data));
      // Cleared only on success, so a failed upload keeps the preview and the
      // user can retry or undo rather than losing their selection
      setPendingAvatar(null);
      return true;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't upload that photo.");
      return false;
    } finally {
      setAvatarUploading(false);
    }
  }

  async function removeAvatar() {
    setError("");
    setAvatarUploading(true);
    try {
      const data = await apiClient.delete("/profile/avatar", { auth: true });
      setServerData(data);
      // The topbar and menus read name and photo from AuthContext, not this form
      refreshAuth();
      setForm(toForm(data));
      setPendingAvatar(null);
      return true;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't remove that photo.");
      return false;
    } finally {
      setAvatarUploading(false);
    }
  }

  const bmi = (() => {
    const h = numberOrNull(form.height);
    const w = numberOrNull(form.weight);
    if (!h || !w) return null;
    const metres = h / 100;
    return Math.round((w / (metres * metres)) * 10) / 10;
  })();

  const bmiLabel = (() => {
    if (bmi === null) return null;
    if (bmi < 18.5) return "Underweight";
    if (bmi < 25) return "Normal";
    if (bmi < 30) return "Overweight";
    return "Obese";
  })();

  // Not mid-edit: a reload would wipe what's been typed
  usePullRefresh(() => (editing ? undefined : load()));

  return {
    form,
    serverData,
    avatarUploading,
    avatarPreviewUri,
    avatarDirty,
    changeAvatar,
    saveAvatar,
    undoAvatar,
    removeAvatar,
    loading,
    saving,
    editing,
    error,
    setError,
    clearError: () => setError(""),
    saved,
    bmi,
    bmiLabel,
    handleChange,
    handleSave,
    startEditing,
    cancelEditing,
    refresh: load,
  };
}