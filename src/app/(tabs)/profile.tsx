import { currentUser } from "@/data/placeholders";
import { colors, radii, spacing, typography } from "@/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

function OverviewStat({ icon, label, value, valueColor }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number; valueColor?: string }) {
  return (
    <View style={styles.overviewStat}>
      <View style={styles.overviewLabelRow}>
        <Ionicons name={icon} size={14} color={colors.primary} />
        <Text style={styles.overviewLabel}>{label}</Text>
      </View>
      <Text style={[styles.overviewValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
    </View>
  );
}

function PlanRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <Pressable style={styles.rowItem}>
      <Ionicons name={icon} size={20} color={colors.primary} style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Profile</Text>
        <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
      </View>

      <View style={styles.banner}>
        <View style={styles.avatarWrap}>
          <Ionicons name="person" size={40} color="#B0B0B0" />
        </View>
        <View style={styles.bannerInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{currentUser.name}</Text>
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>{currentUser.plan}</Text>
            </View>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="mail-outline" size={13} color={colors.white} />
            <Text style={styles.metaText}>{currentUser.email}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.white} />
            <Text style={styles.metaText}>Joined {currentUser.joined}</Text>
          </View>
        </View>
        <Pressable style={styles.editBtn}>
          <Ionicons name="pencil" size={16} color={colors.white} />
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>My Overview</Text>
        <View style={styles.overviewRow}>
          <OverviewStat icon="resize-outline" label="Height" value={`${currentUser.height} cm`} />
          <OverviewStat icon="barbell-outline" label="Weight" value={`${currentUser.weight} kg`} />
          <OverviewStat icon="pulse-outline" label="BMI" value={currentUser.bmi} valueColor={colors.primary} />
          <OverviewStat icon="flag-outline" label="Goal" value={currentUser.goal} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>My Plan</Text>
        <PlanRow icon="flag-outline" label="Fitness Goal" value={currentUser.goal} />
        <PlanRow icon="restaurant-outline" label="Diet Preference" value={currentUser.dietPreference} />
        <PlanRow icon="walk-outline" label="Activity Level" value={currentUser.activityLevel} />
        <PlanRow icon="heart-outline" label="Health Conditions" value={currentUser.healthConditions} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Settings</Text>
        <PlanRow icon="person-outline" label="Personal Information" value="" />
        <View style={styles.rowItem}>
          <Ionicons name="notifications-outline" size={20} color={colors.primary} style={styles.rowIcon} />
          <Text style={styles.rowLabel}>Notifications</Text>
          <Switch value={notifications} onValueChange={setNotifications} trackColor={{ true: colors.primary }} />
        </View>
        <PlanRow icon="resize-outline" label="Units" value="Metric (kg, cm, km)" />
        <PlanRow icon="moon-outline" label="Theme" value="Light" />
        <PlanRow icon="globe-outline" label="Language" value="English" />
        <Pressable style={styles.rowItem} onPress={() => router.dismissTo("/login")}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} style={styles.rowIcon} />
          <Text style={[styles.rowLabel, { color: colors.danger }]}>Logout</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgWhite },
  container: { paddingBottom: 40 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingTop: 54, paddingBottom: spacing.md },
  title: { ...typography.h1 },
  banner: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, marginHorizontal: spacing.lg, borderRadius: radii.lg, padding: spacing.md, marginBottom: -40, zIndex: 1 },
  avatarWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#E0E0E0", alignItems: "center", justifyContent: "center", marginRight: spacing.md },
  bannerInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  userName: { color: colors.white, fontWeight: "800", fontSize: 17 },
  proBadge: { backgroundColor: "rgba(255,255,255,0.25)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.pill },
  proBadgeText: { color: colors.white, fontSize: 11, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  metaText: { color: colors.white, fontSize: 12 },
  editBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.white, marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.cardBorder, padding: spacing.md, paddingTop: spacing.lg },
  cardTitle: { ...typography.h3, marginBottom: spacing.md },
  overviewRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  overviewStat: { width: "47%", backgroundColor: colors.bgWhite, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radii.md, padding: 10 },
  overviewLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  overviewLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "600" },
  overviewValue: { fontSize: 17, fontWeight: "800", color: colors.textPrimary },
  rowItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  rowIcon: { marginRight: 12 },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.textPrimary },
  rowValue: { fontSize: 13, color: colors.textSecondary, marginRight: 8 },
});
