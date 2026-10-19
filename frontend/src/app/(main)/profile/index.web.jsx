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
  HEALTH_CONDITIONS_NOTE,
  healthConditionsFor,
  NO_DIET_PREFERENCE,
  SEXES,
} from "@/shared/constants/profileOptions";
import { useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import {
  colors,
  getScreenPalette,
  getScreenTones,
  radii,
  shellColors,
} from "@/shared/theme/nutrifitai";
import { profileStyles } from "@/shared/theme/screenStyles";
import { NAME_MAX } from "@/shared/utils/formValidators";
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
  const { width } = useWindowDimensions();
  const narrow = width < 900;
  const { darkMode } = useTheme();
  // Admins and superadmins keep a name and an email; the body, goal and
  // workout fields belong to ordinary users
  const isUser = useAuth().role === "user";
  const {
    form: profile,
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
  } = useProfileForm({ identityOnly: !isUser });

  // Workout preferences are user-only, like the Workouts screen they shape
  const workoutOptions = useWorkoutOptions(isUser);

  // Remembered per URL, so a new photo after a failed load gets shown
  const [failedUrl, setFailedUrl] = useState(null);
  // A staged pick is a local file, so it always renders; only a stored URL can
  // 404 and fall back to the placeholder.
  const avatarUrl = avatarDirty || avatarPreviewUri !== failedUrl ? avatarPreviewUri : null;

  const { card, textColor } = getScreenPalette(darkMode);
  const inputBg = { backgroundColor: darkMode ? shellColors.dark.cardBg : colors.white };
  // Dropdown colors for the current theme
  const palette = { surface: inputBg.backgroundColor, border: card.borderColor, text: textColor.color };
  const disabledBg = { backgroundColor: getScreenTones(darkMode).surfaceMuted };
  const joined = joinedLabel(serverData?.createdAt);

  // Same card wherever it sits; `extra` places it
  const personalCard = (extra) => (
    <View style={[styles.card, card, extra]}>
      <Text style={[styles.sectionTitle, textColor]}>Personal Information</Text>
      <Text style={styles.sectionSubtitle}>Your basic personal details</Text>

      <View style={styles.fieldsGrid}>
        <ProfileInput maxLength={NAME_MAX} label="First Name" required value={profile.firstName} onChangeText={(v) => handleChange("firstName", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} loading={loading} />
        <ProfileInput maxLength={NAME_MAX} label="Last Name" value={profile.lastName} onChangeText={(v) => handleChange("lastName", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} loading={loading} />
        {/* Read-only: an email change invalidates email_verified_at and the OTP
            challenges tied to the address, so it needs its own re-verification flow. */}
        <ProfileInput label="Email" value={profile.email} editing={false} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} keyboardType="email-address" loading={loading} />
        {isUser && <ProfileInput maxLength={3} label="Age" required value={String(profile.age ?? "")} onChangeText={(v) => handleChange("age", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} keyboardType="numeric" loading={loading} />}
        {isUser && <ProfileInput maxLength={6} label="Height (cm)" required value={String(profile.height ?? "")} onChangeText={(v) => handleChange("height", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} keyboardType="numeric" loading={loading} />}
        {isUser && <ProfileInput maxLength={6} label="Weight (kg)" required value={String(profile.weight ?? "")} onChangeText={(v) => handleChange("weight", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} keyboardType="numeric" loading={loading} />}
        {isUser && (
          <ProfileSelect
            label="Sex"
            value={profile.sex}
            options={SEXES}
            onSelect={(v) => handleChange("sex", v)}
            editing={editing}
            card={card}
            textColor={textColor}
            disabledBg={disabledBg}
            loading={loading}
          />
        )}
      </View>
    </View>
  );

  // First load renders the real page with placeholders where the values go,
  // so nothing shifts once the profile arrives. Titles and labels render as is
  return (
    <DashboardLayout>
      {/* Page Header */}
      <View style={[styles.pageHeader, narrow && styles.pageHeaderNarrow]}>
        <View style={styles.headerText}>
          <Text style={[styles.pageTitle, textColor]}>Profile</Text>
          <Text style={styles.pageSubtitle}>Manage your personal information and preferences.</Text>
        </View>

        {loading ? (
          <Skeleton width={narrow ? 76 : 120} height={36} />
        ) : !editing ? (
          <Pressable onPress={startEditing} style={[styles.actionBtn, narrow && styles.actionBtnNarrow]}>
            <Ionicons name="create-outline" size={15} color={colors.white} />
            <Text style={styles.actionBtnText}>{narrow ? "Edit" : "Edit Profile"}</Text>
          </Pressable>
        ) : (
          <View style={[styles.headerActions, narrow && styles.headerActionsNarrow]}>
            <Pressable onPress={cancelEditing} disabled={saving} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSave} disabled={saving} style={[styles.actionBtn, narrow && styles.actionBtnNarrow, saving && styles.btnDisabled]}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={15} color={colors.white} />
                  <Text style={styles.actionBtnText}>{narrow ? "Save" : "Save Changes"}</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>

      <ScreenError message={error} />

      {/* Save Message */}
      {saved && (
        <View style={[styles.savedBanner, { backgroundColor: darkMode ? "#263322" : colors.mintTint, borderColor: darkMode ? "#14532d" : "#bbf7d0" }]}>
          <Text style={styles.savedText}>Profile updated successfully!</Text>
        </View>
      )}

      {/* Profile Content */}
      <View style={[styles.contentRow, narrow && styles.stackRow]}>
        <View style={[styles.card, card, styles.flex1, narrow && styles.stackItem]}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarCircle, { backgroundColor: getScreenTones(darkMode).border }]}>
              {loading ? null : avatarUrl ? (
                <ServerImage
                  uri={avatarUrl}
                  style={styles.avatarImg}
                  contentFit="cover"
                  onError={() => setFailedUrl(avatarPreviewUri)}
                />
              ) : (
                <Ionicons name="person" size={45} color={colors.textMuted} />
              )}
              {avatarUploading && (
                <View style={styles.avatarBusy}>
                  <ActivityIndicator size="small" color={colors.white} />
                </View>
              )}
            </View>

            {/* Staged: nothing has been sent yet, so the choice is reversible. */}
            {loading ? (
              <View style={styles.avatarActions}>
                <Skeleton width={80} height={14} />
              </View>
            ) : avatarDirty ? (
              <View style={styles.avatarActions}>
                <Pressable onPress={saveAvatar} disabled={avatarUploading}>
                  <Text style={styles.avatarAction}>{avatarUploading ? "Saving…" : "Save photo"}</Text>
                </Pressable>
                <Pressable onPress={undoAvatar} disabled={avatarUploading}>
                  <Text style={styles.avatarActionMuted}>Undo</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.avatarActions}>
                <Pressable onPress={changeAvatar} disabled={avatarUploading}>
                  <Text style={styles.avatarAction}>{avatarUrl ? "Change photo" : "Add photo"}</Text>
                </Pressable>
                {!!avatarUrl && (
                  <Pressable onPress={removeAvatar} disabled={avatarUploading}>
                    <Text style={styles.avatarActionMuted}>Remove</Text>
                  </Pressable>
                )}
              </View>
            )}

            {loading ? (
              <Skeleton width={150} height={20} style={styles.profileNameSkeleton} />
            ) : (
              <Text style={[styles.profileName, textColor]} numberOfLines={2}>
                {profile.firstName} {profile.lastName}
              </Text>
            )}
          </View>

          {/* Who this is; the numbers live in Overview and the fields below */}
          <View style={styles.metaList}>
            <MetaLine icon="mail-outline" text={profile.email} loading={loading} />
            {(loading || !!joined) && <MetaLine icon="calendar-outline" text={`Joined ${joined}`} loading={loading} />}
          </View>
        </View>

        {/* Overview: the body numbers at a glance, BMI worked out from them */}
        {isUser ? (
          <View style={[styles.card, card, styles.flex2, narrow && styles.stackItem]}>
            <Text style={[styles.sectionTitle, textColor]}>Overview</Text>
            <Text style={styles.sectionSubtitle}>Updates as you edit your details</Text>
            <OverviewBoxes form={profile} bmi={bmi} bmiLabel={bmiLabel} card={card} textColor={textColor} loading={loading} large />
          </View>
        ) : (
          personalCard([styles.flex2, narrow && styles.stackItem])
        )}
      </View>

      {/* Users get it as its own section; others beside the avatar card */}
      {isUser && personalCard(styles.sectionSpacing)}

      {/* Fitness Goals: users only */}
      {isUser && (
        <View style={[styles.card, card, styles.sectionSpacing]}>
          <View style={styles.rowGap}>
            <Ionicons name="locate" size={21} color={shellColors.primary} />
            <View>
              <Text style={[styles.sectionTitle, textColor]}>Fitness Goals</Text>
              <Text style={styles.sectionSubtitle}>Customize your fitness preferences</Text>
            </View>
          </View>

          <View style={styles.fieldsGrid}>
            {/* Same dropdowns as registration; "Other" allows custom text */}
            <ProfilePlanField label="Primary Goal" required value={profile.goal} options={GOAL_OPTIONS} icon="flag-outline" placeholder="Select your goal" otherPlaceholder="Your goal (e.g. Run a 10K)" onChange={(v) => handleChange("goal", v)} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} palette={palette} loading={loading} />
            <ProfilePlanField label="Activity Level" required value={profile.activity} options={ACTIVITY_OPTIONS} icon="pulse-outline" placeholder="Select your activity level" otherPlaceholder="Your activity (e.g. Shift work, on my feet)" onChange={(v) => handleChange("activity", v)} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} palette={palette} loading={loading} />
            <ProfilePlanField label="Diet Preference" required value={profile.dietPreference} options={DIET_PREFERENCES} multiple exclusive={NO_DIET_PREFERENCE} icon="nutrition-outline" placeholder="Select any that apply" otherPlaceholder="Your diet (e.g. Intermittent Fasting)" onChange={(v) => handleChange("dietPreference", v)} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} palette={palette} loading={loading} />
            <ProfilePlanField label="Health Conditions" required value={profile.healthConditions} options={healthConditionsFor(profile.sex)} multiple icon="medkit-outline" placeholder="Select any that apply (or None)" otherPlaceholder="Your condition (e.g. Gout)" onChange={(v) => handleChange("healthConditions", v)} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} palette={palette} loading={loading} note={HEALTH_CONDITIONS_NOTE} />
            <ProfileInput maxLength={6} label="Target Weight (kg)" value={String(profile.targetWeight ?? "")} onChangeText={(v) => handleChange("targetWeight", v)} editing={editing} keyboardType="numeric" placeholder="Not set" card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} loading={loading} />
            <ProfileInput maxLength={4} label="Weekly Pace (kg/week, 0.1–1)" value={String(profile.weeklyPace ?? "")} onChangeText={(v) => handleChange("weeklyPace", v)} editing={editing} keyboardType="decimal-pad" placeholder="Not set" card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} loading={loading} />
            {isUser && (
              <ProfileWorkoutPrefs label="Workout Preferences" value={profile.workoutPrefs} onChange={(v) => handleChange("workoutPrefs", v)} options={workoutOptions} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} loading={loading} darkMode={darkMode} />
            )}
          </View>
        </View>
      )}

    </DashboardLayout>
  );
}

function MetaLine({ icon, text, loading }) {
  return (
    <View style={styles.metaLine}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      {loading ? <Skeleton width={150} height={12} /> : <Text style={styles.metaText} numberOfLines={1}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  ...profileStyles,

  card: { borderRadius: radii.sm, borderWidth: 1, padding: 16 }, // p-5 approx
  flex2: { flex: 2 },
  stackRow: { flexDirection: "column" },
  // Stacked (narrow) children size to their content. With flex: n they get a
  // zero basis in a column, collapse, and the next card draws over them
  stackItem: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },

  // Header
  // gap: the buttons keep a space under the title once the row wraps
  pageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20 }, // mb-5
  // Narrow: the same single row as the phone app (title left, buttons right),
  // with the short labels, instead of the buttons dropping under the title
  pageHeaderNarrow: { alignItems: "flex-start", marginBottom: 12 },
  headerActionsNarrow: { gap: 14 },
  actionBtnNarrow: { minWidth: 76, justifyContent: "center", paddingVertical: 8 },
  headerText: { flexShrink: 1, minWidth: 0, flex: 1 },
  pageTitle: { fontSize: 24, fontWeight: "700" }, // text-2xl font-bold
  pageSubtitle: { marginTop: 4, fontSize: 13, color: colors.textMuted },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.sm,
    backgroundColor: shellColors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionBtnText: { fontSize: 12, fontWeight: "600", color: colors.white },

  // Saved banner
  savedBanner: { marginBottom: 16, borderRadius: radii.sm, borderWidth: 1, padding: 12, alignItems: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 9 },
  cancelBtnText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  savedText: { fontSize: 12, fontWeight: "600", color: shellColors.primary },

  // Profile content
  contentRow: { flexDirection: "row", gap: 12 },

  avatarWrap: { alignItems: "center" },
  avatarCircle: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%", borderRadius: 48 },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  avatarActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  avatarAction: { fontSize: 12, fontWeight: "700", color: shellColors.primary },
  avatarActionMuted: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  profileName: { marginTop: 16, fontSize: 18, fontWeight: "700" }, // mt-4 text-lg font-bold

  metaList: { marginTop: 16, gap: 8, alignSelf: "stretch", alignItems: "center" },
  metaLine: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  metaText: { fontSize: 12, color: colors.textMuted, flexShrink: 1 },

  // Sections
  sectionTitle: { fontSize: 18, fontWeight: "700" }, // text-lg font-bold
  sectionSubtitle: { marginTop: 4, fontSize: 12, color: colors.textMuted },
  sectionSpacing: { marginTop: 12 }, // mt-3

  // Fields
  fieldsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 20 }, 

  profileNameSkeleton: { marginTop: 16 },
});