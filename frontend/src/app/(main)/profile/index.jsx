import { ProfileInput, ProfilePlanField, ProfileSelect, ProfileWorkoutPrefs } from "@/features/user/components/ProfileFields";
import { joinedLabel, OverviewBoxes } from "@/features/user/components/ProfileWidgets";
import { useProfileForm } from "@/features/user/hooks/useProfileForm";
import { useWorkoutOptions } from "@/features/workouts/components/WorkoutPrefsPicker";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import Skeleton from "@/shared/components/Skeleton";
import { ScreenError } from "@/shared/components/ui/ScreenAlert";
import ServerImage from "@/shared/components/ui/ServerImage";
import {
  ACTIVITY_OPTIONS,
  DIET_PREFERENCES,
  GOAL_OPTIONS,
  HEALTH_CONDITIONS,
  HEALTH_CONDITIONS_NOTE,
  NO_DIET_PREFERENCE,
  SEXES,
} from "@/shared/constants/profileOptions";
import { useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenPalette, getScreenTones, radii, screenTones, shellColors } from "@/shared/theme/nutrifitai";
import { profileStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

export default function ProfileScreen() {
  const { darkMode, shell: c } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const {
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
    saved,
    bmi,
    bmiLabel,
    handleChange,
    handleSave,
    startEditing,
    cancelEditing,
  } = useProfileForm();

  // Workout preferences are user-only, like the Workouts screen they shape
  const isUser = useAuth().role === "user";
  const workoutOptions = useWorkoutOptions(isUser);

  // Remembered per URL, so a new photo after a failed load gets shown
  const [failedUrl, setFailedUrl] = useState(null);
  // A staged pick is a local file, so it always renders; only a stored URL can
  // 404 and fall back to the placeholder.
  const avatarUrl = avatarDirty || avatarPreviewUri !== failedUrl ? avatarPreviewUri : null;

  // Same card tones as web and the dashboard
  const { card, textColor } = getScreenPalette(darkMode);
  const inputBg = { backgroundColor: darkMode ? shellColors.dark.cardBg : colors.white };
  const disabledBg = { backgroundColor: getScreenTones(darkMode).surfaceMuted };
  // Dropdown colors for the current theme
  const palette = { surface: inputBg.backgroundColor, border: card.borderColor, text: textColor.color };

  const displayName = [form.firstName, form.lastName].filter(Boolean).join(" ") || "Your profile";
  const joined = joinedLabel(serverData?.createdAt);

  // First load renders the real page with placeholders where the values go,
  // so nothing shifts once the profile arrives. The title renders as is
  return (
    <DashboardLayout>
      {/* Header */}
      <View style={styles.topBar}>
        <Text style={[styles.pageTitle, textColor]}>Profile</Text>

        {loading ? (
          <Skeleton width={76} height={32} borderRadius={radii.pill} />
        ) : editing ? (
          <View style={styles.topActions}>
            <Pressable onPress={cancelEditing} disabled={saving}>
              <Text style={[styles.cancelText, { color: c.inactiveNavText }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={14} color={colors.white} />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.saveBtn} onPress={startEditing}>
            <Ionicons name="create-outline" size={14} color={colors.white} />
            <Text style={styles.saveBtnText}>Edit</Text>
          </Pressable>
        )}
      </View>

      <ScreenError message={error} />

      {saved && (
        <View style={styles.savedBanner}>
          <Ionicons name="checkmark-circle-outline" size={15} color={shellColors.primary} />
          <Text style={styles.savedText}>Profile updated</Text>
        </View>
      )}

      {/* Info Banner */}
      <View style={styles.banner}>
        <View style={[styles.bannerRow, compact && styles.bannerRowCompact]}>
          {/* Photo, with Remove under it like web; the camera badge changes it */}
          <View style={styles.avatarCol}>
            <View style={[styles.avatarCircle, { backgroundColor: c.avatarBg }]}>
              {loading ? null : avatarUrl ? (
                <ServerImage
                  uri={avatarUrl}
                  style={styles.avatarImg}
                  contentFit="cover"
                  onError={() => setFailedUrl(avatarPreviewUri)}
                />
              ) : (
                <Ionicons name="person" size={40} color={screenTones.dark.muted} />
              )}
              {avatarUploading && (
                <View style={styles.avatarBusy}>
                  <ActivityIndicator size="small" color={colors.white} />
                </View>
              )}

              {!avatarDirty && !loading && (
                <Pressable
                  style={styles.avatarEditBadge}
                  onPress={changeAvatar}
                  disabled={avatarUploading}
                  hitSlop={6}
                >
                  <Ionicons name="camera" size={13} color={colors.white} />
                </Pressable>
              )}
            </View>
            {!avatarDirty && !loading && !!avatarUrl && (
              <Pressable onPress={removeAvatar} disabled={avatarUploading} hitSlop={6}>
                <Text style={styles.removePhotoText}>Remove</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.flex1}>
            <View style={styles.rowGap}>
              {loading ? (
                <Skeleton width={140} height={20} style={styles.onBanner} />
              ) : (
                <Text style={styles.name}>{displayName}</Text>
              )}
            </View>

            {/* Staged: nothing has been sent yet, so the choice is reversible. */}
            {avatarDirty && (
              <View style={styles.avatarStagedRow}>
                <Pressable onPress={saveAvatar} disabled={avatarUploading} style={styles.avatarStagedBtn}>
                  <Ionicons name="checkmark" size={13} color="#2f8f17" />
                  <Text style={styles.avatarStagedSave}>{avatarUploading ? "Saving…" : "Save photo"}</Text>
                </Pressable>
                <Pressable onPress={undoAvatar} disabled={avatarUploading} style={styles.avatarStagedBtn}>
                  <Ionicons name="arrow-undo" size={13} color={colors.white} />
                  <Text style={styles.avatarStagedUndo}>Undo</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.metaRow}>
              <Ionicons name="mail" size={13} color={colors.white} />
              {loading ? (
                <Skeleton width={160} height={12} style={styles.onBanner} />
              ) : (
                <Text style={styles.metaTextUnderline}>{form.email || "—"}</Text>
              )}
            </View>

            {(loading || !!joined) && (
              <View style={styles.metaRow}>
                <Ionicons name="calendar" size={13} color={colors.white} />
                {loading ? (
                  <Skeleton width={110} height={12} style={styles.onBanner} />
                ) : (
                  <Text style={styles.metaText}>Joined {joined}</Text>
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* Overview: the body numbers at a glance, BMI worked out from them */}
      <View style={[styles.card, card, styles.overviewCard]}>
        <Text style={[styles.cardTitle, textColor]}>Overview</Text>

        <OverviewBoxes form={form} bmi={bmi} bmiLabel={bmiLabel} card={card} textColor={textColor} loading={loading} compact={compact} />
      </View>

      {/* Personal Information */}
      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, textColor]}>Personal Information</Text>

        <ProfileInput label="First Name" required value={form.firstName} onChangeText={(v) => handleChange("firstName", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} loading={loading} />
        <ProfileInput label="Last Name" value={form.lastName} onChangeText={(v) => handleChange("lastName", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} loading={loading} />
        {/* Email is read-only: changing it would invalidate email verification,
            so it needs its own re-verification flow rather than a silent edit. */}
        <ProfileInput label="Email" value={form.email} editing={false} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} loading={loading} />

        <ProfileInput label="Age" required value={String(form.age ?? "")} onChangeText={(v) => handleChange("age", v)} editing={editing} keyboardType="numeric" card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} loading={loading} />
        <ProfileInput label="Height (cm)" required value={String(form.height ?? "")} onChangeText={(v) => handleChange("height", v)} editing={editing} keyboardType="numeric" card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} loading={loading} />
        <ProfileInput label="Weight (kg)" required value={String(form.weight ?? "")} onChangeText={(v) => handleChange("weight", v)} editing={editing} keyboardType="numeric" card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} loading={loading} />

        <ProfileSelect label="Sex" value={form.sex} options={SEXES} onSelect={(v) => handleChange("sex", v)} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} loading={loading} />
      </View>

      {/* Fitness Goals */}
      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, textColor]}>Fitness Goals</Text>

        {/* Same dropdowns as registration; "Other" allows custom text */}
        <ProfilePlanField label="Primary Goal" required value={form.goal} options={GOAL_OPTIONS} icon="flag-outline" placeholder="Select your goal" otherPlaceholder="Your goal (e.g. Run a 10K)" onChange={(v) => handleChange("goal", v)} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} palette={palette} loading={loading} />
        <ProfilePlanField label="Activity Level" required value={form.activity} options={ACTIVITY_OPTIONS} icon="pulse-outline" placeholder="Select your activity level" otherPlaceholder="Your activity (e.g. Shift work)" onChange={(v) => handleChange("activity", v)} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} palette={palette} loading={loading} />
        <ProfilePlanField label="Diet Preference" required value={form.dietPreference} options={DIET_PREFERENCES} multiple exclusive={NO_DIET_PREFERENCE} icon="nutrition-outline" placeholder="Select any that apply" otherPlaceholder="Your diet (e.g. Intermittent Fasting)" onChange={(v) => handleChange("dietPreference", v)} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} palette={palette} loading={loading} />
        <ProfilePlanField label="Health Conditions" required value={form.healthConditions} options={HEALTH_CONDITIONS} multiple icon="medkit-outline" placeholder="Select any that apply (or None)" otherPlaceholder="Your condition (e.g. Gout)" onChange={(v) => handleChange("healthConditions", v)} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} palette={palette} loading={loading} note={HEALTH_CONDITIONS_NOTE} />

        <ProfileInput label="Target Weight (kg)" value={String(form.targetWeight ?? "")} onChangeText={(v) => handleChange("targetWeight", v)} editing={editing} keyboardType="numeric" placeholder="Not set" card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} loading={loading} />
        <ProfileInput label="Weekly Pace (kg/week, 0.1–1)" value={String(form.weeklyPace ?? "")} onChangeText={(v) => handleChange("weeklyPace", v)} editing={editing} keyboardType="decimal-pad" placeholder="Not set" card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} loading={loading} />
        {isUser && (
          <ProfileWorkoutPrefs label="Workout Preferences" value={form.workoutPrefs} onChange={(v) => handleChange("workoutPrefs", v)} options={workoutOptions} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} loading={loading} darkMode={darkMode} />
        )}
      </View>

    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  ...profileStyles,

  onBanner: { backgroundColor: "rgba(255,255,255,0.25)" },

  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  pageTitle: { fontSize: 22, fontWeight: "800" },
  topActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  cancelText: { fontSize: 13, fontWeight: "700" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: shellColors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 76,
    justifyContent: "center",
  },
  saveBtnText: { fontSize: 12, fontWeight: "700", color: colors.white },

  savedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.mintTint,
    borderRadius: radii.sm,
    padding: 10,
    marginBottom: 10,
  },
  savedText: { fontSize: 12, color: "#2f8f17", fontWeight: "700" },

  // Info Banner
  banner: { borderRadius: radii.sm, padding: 20, paddingTop: 24, backgroundColor: "#2f8f17" },
  bannerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  bannerRowCompact: { flexDirection: "column", alignItems: "flex-start" },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  // Rounded on the image rather than by clipping the circle, so the camera
  // badge can sit outside the circle's bounds without being cut off.
  avatarImg: { width: "100%", height: "100%", borderRadius: 36 },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#2f8f17",
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 19, fontWeight: "800", color: colors.white },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  avatarStagedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  avatarStagedBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  avatarStagedSave: { fontSize: 11, fontWeight: "800", color: colors.white },
  avatarStagedUndo: { fontSize: 11, fontWeight: "700", color: colors.white },
  metaText: { fontSize: 12, color: colors.white },
  avatarCol: { alignItems: "center", gap: 6 },
  removePhotoText: { fontSize: 11, fontWeight: "700", color: colors.white, textDecorationLine: "underline" },
  metaTextUnderline: { fontSize: 12, color: colors.white, textDecorationLine: "underline" },

  // Cards
  card: { borderRadius: radii.sm, borderWidth: 1, padding: 16, marginTop: 12 },
  overviewCard: { marginTop: -10 },
  cardTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
});