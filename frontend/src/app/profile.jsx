import DashboardLayout from "@components/nutrifit/DashboardLayout";
import { useTheme } from "@context/ThemeContext";
import { radii } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";


const OVERVIEW = [
  { icon: "resize-outline", label: "Height", value: "170", unit: "cm" },
  { icon: "barbell", label: "Weight", value: "70", unit: "kg" },
  { icon: "body-outline", label: "BMI", value: "24.2", note: "Normal" },
  { icon: "locate", label: "Goal", value: "Lose Weight" },
];

const PLAN_ITEMS = [
  { icon: "locate", label: "Fitness Goal", value: "Lose Weight" },
  { icon: "restaurant-outline", label: "Diet Preference", value: "High Protein" },
  { icon: "footsteps-outline", label: "Activity Level", value: "Moderate" },
  { icon: "pulse-outline", label: "Health Conditions", value: "None" },
];

export default function ProfileScreen() {
  const { darkMode, toggleTheme, shell: c } = useTheme();
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);

  const card = { backgroundColor: c.cardBg, borderColor: c.dropdownBorder };
  const textColor = { color: c.sidebarText };
  const divider = { borderTopColor: c.dropdownBorder };
  const iconCircleBg = { backgroundColor: c.activeNavBg };

  const handleLogout = () => router.replace("/login");

  return (
    <DashboardLayout>
      {/* Header */}
      <View style={styles.topBar}>
        <Text style={[styles.pageTitle, textColor]}>Profile</Text>
        <Ionicons name="notifications-outline" size={22} color={c.notifIcon} />
      </View>

      {/* Info Banner */}
      <View style={styles.banner}>
        <Pressable style={styles.editBtn}>
          <Ionicons name="pencil" size={16} color="#ffffff" />
        </Pressable>

        <View style={styles.bannerRow}>
          <View style={[styles.avatarCircle, { backgroundColor: c.avatarBg }]}>
            <Ionicons name="person" size={40} color="#9ca3af" />
          </View>

          <View style={styles.flex1}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>Jose Manalo</Text>
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>Pro</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Ionicons name="mail" size={13} color="#ffffff" />
              <Text style={styles.metaTextUnderline}>josemanalo@gmail.com</Text>
            </View>

            <View style={styles.metaRow}>
              <Ionicons name="calendar" size={13} color="#ffffff" />
              <Text style={styles.metaText}>Joined May 2024</Text>
            </View>
          </View>
        </View>
      </View>

      {/* My Overview */}
      <View style={[styles.card, card, styles.overviewCard]}>
        <Text style={[styles.cardTitle, textColor]}>My Overview</Text>

        <View style={styles.overviewRow}>
          {OVERVIEW.map((item) => (
            <View key={item.label} style={[styles.overviewBox, { borderColor: card.borderColor }]}>
              <View style={styles.overviewLabelRow}>
                <Ionicons name={item.icon} size={13} color="#4CAF2F" />
                <Text style={[styles.overviewLabel, textColor]}>{item.label}</Text>
              </View>
              <Text style={[styles.overviewValue, textColor]}>
                {item.value}
                {item.unit ? <Text style={styles.overviewUnit}> {item.unit}</Text> : null}
              </Text>
              {item.note && <Text style={styles.overviewNote}>{item.note}</Text>}
            </View>
          ))}
        </View>
      </View>

      {/* My Plan */}
      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, textColor]}>My Plan</Text>

        <View style={[styles.listDivider, divider]}>
          {PLAN_ITEMS.map((item, i) => (
            <Pressable key={item.label} style={[styles.listRow, i > 0 && styles.listRowBorder, i > 0 && divider]}>
              <View style={[styles.rowIcon, iconCircleBg]}>
                <Ionicons name={item.icon} size={17} color="#4CAF2F" />
              </View>
              <Text style={[styles.rowLabel, textColor]}>{item.label}</Text>
              <Text style={styles.rowValue}>{item.value}</Text>
              <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
            </Pressable>
          ))}
        </View>
      </View>

      {/* Settings */}
      <View style={[styles.card, card]}>
        <Text style={[styles.cardTitle, textColor]}>Settings</Text>

        <View style={[styles.listDivider, divider]}>
          <Pressable style={styles.listRow} onPress={() => router.push("/profile")}>
            <Ionicons name="person-outline" size={19} color={c.notifIcon} style={styles.rowIconPlain} />
            <Text style={[styles.rowLabel, textColor]}>Personal Information</Text>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </Pressable>

          <View style={[styles.listRow, styles.listRowBorder, divider]}>
            <Ionicons name="notifications-outline" size={19} color={c.notifIcon} style={styles.rowIconPlain} />
            <Text style={[styles.rowLabel, textColor]}>Notifications</Text>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ true: c.primary, false: c.toggleTrackOff }}
              thumbColor="#ffffff"
            />
          </View>

          <Pressable style={[styles.listRow, styles.listRowBorder, divider]}>
            <Ionicons name="swap-horizontal-outline" size={19} color={c.notifIcon} style={styles.rowIconPlain} />
            <Text style={[styles.rowLabel, textColor]}>Units</Text>
            <Text style={styles.rowValue}>Metric (kg, cm, km)</Text>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </Pressable>

          <Pressable style={[styles.listRow, styles.listRowBorder, divider]} onPress={toggleTheme}>
            <Ionicons name={darkMode ? "moon" : "sunny"} size={19} color={c.notifIcon} style={styles.rowIconPlain} />
            <Text style={[styles.rowLabel, textColor]}>Theme</Text>
            <Text style={styles.rowValue}>{darkMode ? "Dark" : "Light"}</Text>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </Pressable>

          <Pressable style={[styles.listRow, styles.listRowBorder, divider]}>
            <Ionicons name="globe-outline" size={19} color={c.notifIcon} style={styles.rowIconPlain} />
            <Text style={[styles.rowLabel, textColor]}>Language</Text>
            <Text style={styles.rowValue}>English</Text>
            <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
          </Pressable>

          <Pressable style={[styles.listRow, styles.listRowBorder, divider]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={19} color={c.danger} style={styles.rowIconPlain} />
            <Text style={[styles.rowLabel, styles.logoutText]}>Logout</Text>
          </Pressable>
        </View>
      </View>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },

  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  pageTitle: { fontSize: 22, fontWeight: "800" },

  // Info Banner
  banner: { borderRadius: radii.sm, padding: 20, paddingTop: 24, backgroundColor: "#2f8f17" },
  editBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 19, fontWeight: "800", color: "#ffffff" },
  proBadge: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 2 },
  proBadgeText: { fontSize: 11, fontWeight: "700", color: "#ffffff" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  metaText: { fontSize: 12, color: "#ffffff" },
  metaTextUnderline: { fontSize: 12, color: "#ffffff", textDecorationLine: "underline" },

  // Cards
  card: { borderRadius: radii.sm, borderWidth: 1, padding: 16, marginTop: 12 },
  overviewCard: { marginTop: -10 },
  cardTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },

  // Overview
  overviewRow: { flexDirection: "row", gap: 8 },
  overviewBox: { flex: 1, borderRadius: radii.sm, borderWidth: 1, padding: 8 },
  overviewLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  overviewLabel: { fontSize: 10, fontWeight: "600" },
  overviewValue: { fontSize: 15, fontWeight: "800", marginTop: 8 },
  overviewUnit: { fontSize: 11, fontWeight: "500", color: "#6a7282" },
  overviewNote: { fontSize: 10, fontWeight: "700", color: "#4CAF2F", marginTop: 2 },

  // Plan
  listDivider: {},
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  listRowBorder: { borderTopWidth: 1 },
  rowIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  rowIconPlain: { width: 22 },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: "700" },
  rowValue: { fontSize: 12, color: "#6a7282", marginRight: 4 },
  logoutText: { color: "#fb2c36" },
});
