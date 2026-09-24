import { useLogout } from "@/features/auth/hooks/useLogout";
import { useProfileForm } from "@/features/user/hooks/useProfileForm";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import Skeleton from "@/shared/components/Skeleton";
import AvatarImage from "@/shared/components/ui/AvatarImage";
import { ACTIVITY_LEVELS, GENDERS, GOALS } from "@/shared/constants/profileOptions";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenTones, radii, screenTones, shellColors } from "@/shared/theme/nutrifit";
import { profileStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

const GOAL_LABELS = GOALS.map((g) => g.label);
const ACTIVITY_LABELS = ACTIVITY_LEVELS.map((a) => a.label);

function joinedLabel(createdAt) {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export default function ProfileScreen() {
  const { darkMode, toggleTheme, shell: c } = useTheme();
  const router = useRouter();
  const logout = useLogout();
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

  const [avatarFailed, setAvatarFailed] = useState(false);
  // A staged pick is a local file, so it always renders; only a stored URL can
  // 404 and fall back to the placeholder.
  const avatarUrl = avatarDirty || !avatarFailed ? avatarPreviewUri : null;

  const card = { backgroundColor: c.cardBg, borderColor: c.dropdownBorder };
  const textColor = { color: c.sidebarText };
  const divider = { borderTopColor: c.dropdownBorder };
  const iconCircleBg = { backgroundColor: c.activeNavBg };
  const inputBg = { backgroundColor: darkMode ? shellColors.dark.cardBg : colors.white };
  const disabledBg = { backgroundColor: getScreenTones(darkMode).surfaceMuted };

  const notificationsOn = serverData?.notificationsEnabled ?? true;
  const displayName = [form.firstName, form.lastName].filter(Boolean).join(" ") || "Your profile";
  const joined = joinedLabel(serverData?.createdAt);

  if (loading) {
    return (
      <DashboardLayout>
        <View style={styles.skeletonWrap}>
          <View style={styles.skeletonTopBar}>
            <Skeleton width={100} height={26} />
          </View>

          <View style={[styles.card, card, styles.skeletonHeaderCard]}>
            <Skeleton width={72} height={72} borderRadius={36} />
            <View style={styles.skeletonHeaderText}>
              <Skeleton width="55%" height={18} />
              <Skeleton width="35%" height={12} style={{ marginTop: 8 }} />
            </View>
          </View>

          <View style={[styles.card, card, styles.skeletonFieldsCard]}>
            <Skeleton width="30%" height={13} />
            <Skeleton width="100%" height={40} style={{ marginTop: 10 }} />
            <Skeleton width="30%" height={13} style={{ marginTop: 16 }} />
            <Skeleton width="100%" height={40} style={{ marginTop: 10 }} />
            <Skeleton width="30%" height={13} style={{ marginTop: 16 }} />
            <Skeleton width="100%" height={40} style={{ marginTop: 10 }} />
          </View>
        </View>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <View style={styles.topBar}>
        <Text style={[styles.pageTitle, textColor]}>Profile</Text>

        {editing ? (
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

      {!!error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {saved && (
        <View style={styles.savedBanner}>
          <Ionicons name="checkmark-circle-outline" size={15} color={shellColors.primary} />
          <Text style={styles.savedText}>Profile updated</Text>
        </View>
      )}

      {/* Info Banner */}
      <View style={styles.banner}>
        <View style={[styles.bannerRow, compact && styles.bannerRowCompact]}>
          <View style={[styles.avatarCircle, { backgroundColor: c.avatarBg }]}>
            {avatarUrl ? (
              <AvatarImage
                uri={avatarUrl}
                style={styles.avatarImg}
                contentFit="cover"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <Ionicons name="person" size={40} color={screenTones.dark.muted} />
            )}
            {avatarUploading && (
              <View style={styles.avatarBusy}>
                <ActivityIndicator size="small" color={colors.white} />
              </View>
            )}

            {!avatarDirty && (
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

          <View style={styles.flex1}>
            <View style={styles.rowGap}>
              <Text style={styles.name}>{displayName}</Text>
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
              <Text style={styles.metaTextUnderline}>{form.email || "—"}</Text>
            </View>

            {!!joined && (
              <View style={styles.metaRow}>
                <Ionicons name="calendar" size={13} color={colors.white} />
                <Text style={styles.metaText}>Joined {joined}</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* My Overview */}
      <View style={[styles.card, card, styles.overviewCard]}>
        <Text style={[styles.cardTitle, textColor]}>My Overview</Text>

        <View style={[styles.overviewRow, compact && styles.wrapRow]}>
          <OverviewBox icon="resize-outline" label="Height" value={form.height || "—"} unit={form.height ? "cm" : ""} compact={compact} card={card} textColor={textColor} />
          <OverviewBox icon="barbell" label="Weight" value={form.weight || "—"} unit={form.weight ? "kg" : ""} compact={compact} card={card} textColor={textColor} />
          <OverviewBox icon="body-outline" label="BMI" value={bmi ?? "—"} note={bmiLabel} compact={compact} card={card} textColor={textColor} />
          <OverviewBox icon="locate" label="Goal" value={form.goal || "Not set"} compact={compact} card={card} textColor={textColor} />
        </View>
      </View>

      {/* Personal Information */}
      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, textColor]}>Personal Information</Text>

        <Field label="First Name" value={form.firstName} onChangeText={(v) => handleChange("firstName", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} />
        <Field label="Last Name" value={form.lastName} onChangeText={(v) => handleChange("lastName", v)} editing={editing} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} />
        <Field label="Age" value={String(form.age ?? "")} onChangeText={(v) => handleChange("age", v)} editing={editing} keyboardType="numeric" card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} />
        <Field label="Height (cm)" value={String(form.height ?? "")} onChangeText={(v) => handleChange("height", v)} editing={editing} keyboardType="numeric" card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} />
        <Field label="Weight (kg)" value={String(form.weight ?? "")} onChangeText={(v) => handleChange("weight", v)} editing={editing} keyboardType="numeric" card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} />

        {/* Email is read-only: changing it would invalidate email verification,
            so it needs its own re-verification flow rather than a silent edit. */}
        <Field label="Email" value={form.email} editing={false} card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} />

        <Chips label="Gender" value={form.gender} options={GENDERS} onSelect={(v) => handleChange("gender", v)} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} />
      </View>

      {/* My Plan */}
      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, textColor]}>My Plan</Text>

        <Chips label="Fitness Goal" value={form.goal} options={GOAL_LABELS} onSelect={(v) => handleChange("goal", v)} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} />
        <Chips label="Activity Level" value={form.activity} options={ACTIVITY_LABELS} onSelect={(v) => handleChange("activity", v)} editing={editing} card={card} textColor={textColor} disabledBg={disabledBg} />
        <Field label="Diet Preference" value={form.dietPreference} onChangeText={(v) => handleChange("dietPreference", v)} editing={editing} placeholder="e.g. High Protein" card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} />
        <Field label="Health Conditions" value={form.healthConditions} onChangeText={(v) => handleChange("healthConditions", v)} editing={editing} placeholder="None" multiline card={card} textColor={textColor} inputBg={inputBg} disabledBg={disabledBg} />
      </View>

      {/* Settings */}
      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, textColor]}>Settings</Text>

        <View style={styles.listDivider}>
          <View style={styles.listRow}>
            <Ionicons name="notifications-outline" size={19} color={c.notifIcon} style={styles.rowIconPlain} />
            <Text style={[styles.rowLabel, textColor]}>Notifications</Text>
            {/* Read-only for now: the column is persisted but nothing
                consumes it yet, so offering a toggle would imply a
                notification system that doesn't exist. */}
            <Switch
              value={notificationsOn}
              disabled
              trackColor={{ true: c.primary, false: c.toggleTrackOff }}
              thumbColor={colors.white}
            />
          </View>

          <Pressable style={[styles.listRow, styles.listRowBorder, divider]} onPress={toggleTheme}>
            <Ionicons name={darkMode ? "moon" : "sunny"} size={19} color={c.notifIcon} style={styles.rowIconPlain} />
            <Text style={[styles.rowLabel, textColor]}>Theme</Text>
            <Text style={styles.rowValue}>{darkMode ? "Dark" : "Light"}</Text>
            <Ionicons name="chevron-forward" size={16} color={screenTones.dark.muted} />
          </Pressable>

          <Pressable style={[styles.listRow, styles.listRowBorder, divider]} onPress={logout}>
            <Ionicons name="log-out-outline" size={19} color={c.danger} style={styles.rowIconPlain} />
            <Text style={[styles.rowLabel, styles.logoutText]}>Logout</Text>
          </Pressable>
        </View>
      </View>
    </DashboardLayout>
  );
}

function OverviewBox({ icon, label, value, unit, note, compact, card, textColor }) {
  return (
    <View style={[styles.overviewBox, compact && styles.overviewBoxCompact, { borderColor: card.borderColor }]}>
      <View style={styles.overviewLabelRow}>
        <Ionicons name={icon} size={13} color={shellColors.primary} />
        <Text style={[styles.overviewLabel, textColor]}>{label}</Text>
      </View>
      <Text style={[styles.overviewValue, textColor]} numberOfLines={1}>
        {value}
        {unit ? <Text style={styles.overviewUnit}> {unit}</Text> : null}
      </Text>
      {!!note && <Text style={styles.overviewNote}>{note}</Text>}
    </View>
  );
}

function Field({ label, value, onChangeText, editing, card, textColor, inputBg, disabledBg, keyboardType = "default", placeholder, multiline = false }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, textColor]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editing && !!onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          { borderColor: card.borderColor },
          editing && onChangeText ? inputBg : disabledBg,
          textColor,
        ]}
      />
    </View>
  );
}

function Chips({ label, value, options, onSelect, editing, card, textColor, disabledBg }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, textColor]}>{label}</Text>

      {editing ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {options.map((opt) => {
            const active = opt === value;
            return (
              <Pressable
                key={opt}
                onPress={() => onSelect(opt)}
                style={[styles.chip, { borderColor: card.borderColor }, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : textColor]}>{opt}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={[styles.input, { borderColor: card.borderColor }, disabledBg, styles.selectDisplay]}>
          <Text style={[styles.selectDisplayText, textColor]}>{value || "Not set"}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ...profileStyles,

  loadingWrap: { paddingVertical: 64, alignItems: "center", justifyContent: "center" },
  skeletonWrap: {},
  skeletonTopBar: { marginBottom: 12 },
  skeletonHeaderCard: { flexDirection: "row", alignItems: "center", gap: 16 },
  skeletonHeaderText: { flex: 1 },
  skeletonFieldsCard: {},

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

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.dangerBg,
    borderRadius: radii.sm,
    padding: 10,
    marginBottom: 10,
  },
  errorText: { flex: 1, fontSize: 12, color: colors.danger, fontWeight: "600" },
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
  metaTextUnderline: { fontSize: 12, color: colors.white, textDecorationLine: "underline" },

  // Cards
  card: { borderRadius: radii.sm, borderWidth: 1, padding: 16, marginTop: 12 },
  overviewCard: { marginTop: -10 },
  cardTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },

  // Overview
  overviewRow: { flexDirection: "row", gap: 8 },
  overviewBox: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: 8 },
  overviewBoxCompact: { flexBasis: "47%" },
  overviewLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  overviewLabel: { fontSize: 10, fontWeight: "600" },
  overviewValue: { fontSize: 15, fontWeight: "800", marginTop: 8 },
  overviewUnit: { fontSize: 11, fontWeight: "500", color: colors.textMuted },
  overviewNote: { fontSize: 10, fontWeight: "700", color: shellColors.primary, marginTop: 2 },

  // Fields
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  inputMultiline: { minHeight: 72, textAlignVertical: "top" },
  selectDisplayText: { fontSize: 14 },
  chipsRow: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 12, fontWeight: "600" },

  // Settings list
  listDivider: {},
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  listRowBorder: { borderTopWidth: 1 },
  rowIconPlain: { width: 22 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: "700" },
  rowValue: { maxWidth: "42%", flexShrink: 1, textAlign: "right", fontSize: 12, color: colors.textMuted, marginRight: 4 },
  logoutText: { color: colors.danger },
});