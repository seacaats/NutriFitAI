import { useProfileForm } from "@/features/user/hooks/useProfileForm";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import Skeleton from "@/shared/components/Skeleton";
import AvatarImage from "@/shared/components/ui/AvatarImage";
import { ACTIVITY_LEVELS, GENDERS, GOALS } from "@/shared/constants/profileOptions";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenPalette, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifit";
import { profileStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

const GOAL_OPTIONS = GOALS.map((g) => g.label);
// user_profiles.activity_level -- persisted since the profile API was added.
const ACTIVITY_OPTIONS = ACTIVITY_LEVELS.map((a) => a.label);

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const narrow = width < 900;
  const { darkMode } = useTheme();
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
    handleChange,
    handleSave,
    startEditing,
    cancelEditing,
  } = useProfileForm();

  const [avatarFailed, setAvatarFailed] = useState(false);
  // A staged pick is a local file, so it always renders; only a stored URL can
  // 404 and fall back to the placeholder.
  const avatarUrl = avatarDirty || !avatarFailed ? avatarPreviewUri : null;

  const { card, textColor } = getScreenPalette(darkMode);
  const inputBg = { backgroundColor: darkMode ? shellColors.dark.cardBg : colors.white };
  const disabledBg = { backgroundColor: getScreenTones(darkMode).surfaceMuted };

  if (loading) {
    return (
      <DashboardLayout>
        <View style={[styles.pageHeader, narrow && styles.wrapRow]}>
          <View>
            <Skeleton width={140} height={24} />
            <Skeleton width={260} height={13} style={{ marginTop: 8 }} />
          </View>
        </View>

        <View style={[styles.card, card, { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 16 }]}>
          <Skeleton width={80} height={80} borderRadius={40} />
          <View style={{ flex: 1 }}>
            <Skeleton width="40%" height={18} />
            <Skeleton width="25%" height={12} style={{ marginTop: 8 }} />
          </View>
        </View>

        <View style={[styles.card, card, { marginTop: 16 }]}>
          <Skeleton width="20%" height={13} />
          <Skeleton width="100%" height={40} style={{ marginTop: 10 }} />
          <Skeleton width="20%" height={13} style={{ marginTop: 16 }} />
          <Skeleton width="100%" height={40} style={{ marginTop: 10 }} />
          <Skeleton width="20%" height={13} style={{ marginTop: 16 }} />
          <Skeleton width="100%" height={40} style={{ marginTop: 10 }} />
        </View>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Page Header */}
      <View style={[styles.pageHeader, narrow && styles.wrapRow]}>
        <View>
          <Text style={[styles.pageTitle, textColor]}>Profile</Text>
          <Text style={styles.pageSubtitle}>Manage your personal information and fitness goals.</Text>
        </View>

        {!editing ? (
          <Pressable onPress={startEditing} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={15} color={colors.white} />
            <Text style={styles.actionBtnText}>Edit Profile</Text>
          </Pressable>
        ) : (
          <View style={styles.headerActions}>
            <Pressable onPress={cancelEditing} disabled={saving} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSave} disabled={saving} style={[styles.actionBtn, saving && styles.btnDisabled]}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={15} color={colors.white} />
                  <Text style={styles.actionBtnText}>Save Changes</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>

      {!!error && (
        <View style={[styles.savedBanner, { backgroundColor: darkMode ? "#3a2323" : colors.dangerBg, borderColor: darkMode ? "#7f1d1d" : "#fecaca" }]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Save Message */}
      {saved && (
        <View style={[styles.savedBanner, { backgroundColor: darkMode ? "#263322" : colors.mintTint, borderColor: darkMode ? "#14532d" : "#bbf7d0" }]}>
          <Text style={styles.savedText}>Profile updated successfully! ✓</Text>
        </View>
      )}

      {/* Profile Content */}
      <View style={[styles.contentRow, narrow && styles.stackRow]}>
        <View style={[styles.card, card, styles.flex1]}>
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarCircle, { backgroundColor: getScreenTones(darkMode).border }]}>
              {avatarUrl ? (
                <AvatarImage
                  uri={avatarUrl}
                  style={styles.avatarImg}
                  contentFit="cover"
                  onError={() => setAvatarFailed(true)}
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
            {avatarDirty ? (
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

            <Text style={[styles.profileName, textColor]}>
              {profile.firstName} {profile.lastName}
            </Text>
          </View>

          <View style={styles.profileInfoList}>
            <ProfileInfo icon="mail" label="Email" value={profile.email} darkMode={darkMode} textColor={textColor} />
            <ProfileInfo icon="calendar" label="Age" value={`${profile.age} years old`} darkMode={darkMode} textColor={textColor} />
            <ProfileInfo icon="resize" label="Height" value={`${profile.height} cm`} darkMode={darkMode} textColor={textColor} />
            <ProfileInfo icon="barbell" label="Weight" value={`${profile.weight} kg`} darkMode={darkMode} textColor={textColor} />
          </View>
        </View>

        {/* Personal Information */}
        <View style={[styles.card, card, styles.flex2]}>
          <Text style={[styles.sectionTitle, textColor]}>Personal Information</Text>
          <Text style={styles.sectionSubtitle}>Your basic personal details</Text>

          <View style={styles.fieldsGrid}>
            <InputField label="First Name" value={profile.firstName} onChangeText={(v) => handleChange("firstName", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} />
            <InputField label="Last Name" value={profile.lastName} onChangeText={(v) => handleChange("lastName", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} />
            {/* Read-only: an email change invalidates email_verified_at and the OTP
                challenges tied to the address, so it needs its own re-verification flow. */}
            <InputField label="Email" value={profile.email} editing={false} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} keyboardType="email-address" />
            <InputField label="Age" value={String(profile.age ?? "")} onChangeText={(v) => handleChange("age", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} keyboardType="numeric" />
            <InputField label="Height (cm)" value={String(profile.height ?? "")} onChangeText={(v) => handleChange("height", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} keyboardType="numeric" />
            <InputField label="Weight (kg)" value={String(profile.weight ?? "")} onChangeText={(v) => handleChange("weight", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} keyboardType="numeric" />
            <SelectField
              label="Gender"
              value={profile.gender}
              options={GENDERS}
              onSelect={(v) => handleChange("gender", v)}
              editing={editing}
              card={card}
              textColor={textColor}
              disabledBg={disabledBg}
            />
          </View>
        </View>
      </View>

      {/* Fitness Goals */}
      <View style={[styles.card, card, styles.sectionSpacing]}>
        <View style={styles.rowGap}>
          <Ionicons name="locate" size={21} color={shellColors.primary} />
          <View>
            <Text style={[styles.sectionTitle, textColor]}>Fitness Goals</Text>
            <Text style={styles.sectionSubtitle}>Customize your fitness preferences</Text>
          </View>
        </View>

        <View style={styles.fieldsGrid}>
          <SelectField
            label="Primary Goal"
            value={profile.goal}
            options={GOAL_OPTIONS}
            onSelect={(v) => handleChange("goal", v)}
            editing={editing}
            card={card}
            textColor={textColor}
            disabledBg={disabledBg}
          />

          <SelectField
            label="Activity Level"
            value={profile.activity}
            options={ACTIVITY_OPTIONS}
            onSelect={(v) => handleChange("activity", v)}
            editing={editing}
            card={card}
            textColor={textColor}
            disabledBg={disabledBg}
          />

          <InputField
            label="Diet Preference"
            value={profile.dietPreference || ""}
            onChangeText={(v) => handleChange("dietPreference", v)}
            editing={editing}
            placeholder="e.g. High Protein"
            card={card}
            textColor={textColor}
            inputBg={inputBg}
            disabledBg={disabledBg}
          />

          <InputField
            label="Health Conditions"
            value={profile.healthConditions || ""}
            onChangeText={(v) => handleChange("healthConditions", v)}
            editing={editing}
            placeholder="None"
            multiline
            card={card}
            textColor={textColor}
            inputBg={inputBg}
            disabledBg={disabledBg}
          />
        </View>
      </View>

      {/* Fitness Summary */}
      <View style={[styles.card, card, styles.sectionSpacing]}>
        <Text style={[styles.sectionTitle, textColor]}>Fitness Summary</Text>

        <View style={[styles.summaryRow, styles.wrapRow]}>
          <SummaryCard icon="locate" title="Current Goal" value={profile.goal} card={card} textColor={textColor} />
          <SummaryCard icon="pulse" title="Activity Level" value={profile.activity} card={card} textColor={textColor} />
          <SummaryCard icon="barbell" title="Current Weight" value={`${profile.weight} kg`} card={card} textColor={textColor} />
        </View>
      </View>
    </DashboardLayout>
  );
}



function ProfileInfo({ icon, label, value, darkMode, textColor }) {
  return (
    <View style={[styles.infoRow, { borderColor: getScreenTones(darkMode).border }]}>
      <View style={[styles.infoIcon, { backgroundColor: darkMode ? colors.mintTintDark : colors.mintTint }]}>
        <Ionicons name={icon} size={15} color={shellColors.primary} />
      </View>

      <View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, textColor]}>{value}</Text>
      </View>
    </View>
  );
}

function InputField({ label, value, onChangeText, editing, card, textColor, inputBg, disabledBg, keyboardType = "default", placeholder, multiline = false }) {
  return (
    <View style={styles.fieldHalf}>
      <Text style={[styles.fieldLabel, textColor]}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editing}
        keyboardType={keyboardType}
        placeholder={placeholder}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          { borderColor: card.borderColor },
          editing ? inputBg : disabledBg,
          textColor,
        ]}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

function SelectField({ label, value, options, onSelect, editing, card, textColor, disabledBg }) {
  return (
    <View style={styles.fieldHalf}>
      <Text style={[styles.fieldLabel, textColor]}>{label}</Text>

      {editing ? (
        <View style={styles.chipsWrap}>
          {options.map((opt) => {
            const active = opt === value;
            return (
              <Pressable
                key={opt}
                onPress={() => onSelect(opt)}
                style={[
                  styles.chip,
                  { borderColor: card.borderColor },
                  active && styles.chipActive,
                ]}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : textColor]}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={[styles.input, { borderColor: card.borderColor }, disabledBg, styles.selectDisplay]}>
          <Text style={[styles.selectDisplayText, textColor]}>{value}</Text>
        </View>
      )}
    </View>
  );
}

function SummaryCard({ icon, title, value, card, textColor }) {
  return (
    <View style={[styles.summaryCard, { borderColor: card.borderColor }]}>
      <View style={styles.rowGap}>
        <Ionicons name={icon} size={18} color={shellColors.primary} />
        <Text style={[styles.summaryTitle, textColor]}>{title}</Text>
      </View>

      <Text style={[styles.summaryValue, textColor]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ...profileStyles,

  card: { borderRadius: radii.sm, borderWidth: 1, padding: 16 }, // p-5 approx
  flex2: { flex: 2 },
  stackRow: { flexDirection: "column" },

  // Header
  pageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }, // mb-5
  pageTitle: { fontSize: 24, fontWeight: "700" }, // text-2xl font-bold
  pageSubtitle: { marginTop: 4, fontSize: 13, color: colors.textMuted }, // mt-1 text-sm

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
  loadingWrap: { paddingVertical: 80, alignItems: "center", justifyContent: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 9 },
  cancelBtnText: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  errorText: { fontSize: 13, fontWeight: "700", color: colors.danger },
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
  avatarHint: { fontSize: 10, color: "#d08700", fontWeight: "700", marginTop: 2 },
  profileName: { marginTop: 16, fontSize: 18, fontWeight: "700" }, // mt-4 text-lg font-bold
  profileTag: { marginTop: 4, fontSize: 11, color: colors.textMuted },

  profileInfoList: { marginTop: 24, gap: 12 }, // mt-6 space-y-3

  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: radii.sm, borderWidth: 1, padding: 12 },
  infoIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  infoLabel: { fontSize: 9, color: colors.textMuted },
  infoValue: { marginTop: 2, fontSize: 12, fontWeight: "600" },

  // Sections
  sectionTitle: { fontSize: 18, fontWeight: "700" }, // text-lg font-bold
  sectionSubtitle: { marginTop: 4, fontSize: 12, color: colors.textMuted },
  sectionSpacing: { marginTop: 12 }, // mt-3

  // Fields
  fieldsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 20 }, // mt-5 gap-4
  fieldHalf: { flexGrow: 1, flexBasis: 260, minWidth: 0 }, // responsive two-column grid
  fieldLabel: { fontSize: 12, fontWeight: "600" },
  input: {
    marginTop: 8, // mt-2
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  inputMultiline: { minHeight: 76, textAlignVertical: "top" },

  // Select
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  chip: { borderRadius: radii.sm, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
  chipText: { fontSize: 11, fontWeight: "600" },
  selectDisplayText: { fontSize: 13 },

  // Summary
  summaryRow: { flexDirection: "row", gap: 12, marginTop: 16 }, // mt-4 gap-3
  summaryCard: { flexGrow: 1, flexBasis: 190, minWidth: 0, borderRadius: radii.sm, borderWidth: 1, padding: 16 },
  summaryTitle: { fontSize: 12, fontWeight: "600" },
  summaryValue: { marginTop: 12, fontSize: 13, fontWeight: "700" }, // mt-3
});