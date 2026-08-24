import { currentUser } from "@/data/placeholders";
import { colors, radii, spacing, typography } from "@/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { Slot, usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

const NAV_ITEMS: { href: string; match: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { href: "/(tabs)/home", match: "/home", label: "Home", icon: "home-outline" },
  { href: "/(tabs)/scan", match: "/scan", label: "Scan", icon: "camera-outline" },
  { href: "/(tabs)/ai-coach", match: "/ai-coach", label: "AI Coach", icon: "hardware-chip-outline" },
  { href: "/(tabs)/progress", match: "/progress", label: "Progress", icon: "stats-chart-outline" },
  { href: "/(tabs)/profile", match: "/profile", label: "Profile", icon: "person-outline" },
];

export default function WebTabsLayout() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={styles.shell}>
      <View style={styles.sidebar}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <Ionicons name="barbell-outline" size={18} color={colors.white} />
          </View>
          <Text style={styles.brandText}>NutriFit AI</Text>
        </View>

        <View style={styles.navList}>
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.match;
            return (
              <Pressable
                key={item.href}
                onPress={() => router.push(item.href as never)}
                style={[styles.navItem, active && styles.navItemActive]}
              >
                <Ionicons
                  name={active ? (item.icon.replace("-outline", "") as keyof typeof Ionicons.glyphMap) : item.icon}
                  size={18}
                  color={active ? colors.primaryDark : colors.textSecondary}
                />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Text style={styles.userInitial}>{currentUser.name.charAt(0)}</Text>
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.userName} numberOfLines={1}>{currentUser.name}</Text>
            <Text style={styles.userSub}>View profile</Text>
          </View>
        </View>
      </View>

      <View style={styles.contentArea}>
        <View style={styles.contentInner}>
          <Slot />
        </View>
      </View>
    </View>
  );
}

const SIDEBAR_WIDTH = 248;

const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: "row", backgroundColor: "#F6F7F5", minHeight: "100%" as unknown as number },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.bgWhite,
    borderRightWidth: 1,
    borderRightColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.xl, paddingHorizontal: spacing.xs },
  brandMark: { width: 32, height: 32, borderRadius: radii.sm, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  brandText: { ...typography.h3, color: colors.textPrimary },

  navList: { flex: 1, gap: 2 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  navItemActive: { backgroundColor: colors.bgMint },
  navLabel: { ...typography.body, fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  navLabelActive: { color: colors.primaryDark, fontWeight: "700" },

  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: "#F6F7F5",
  },
  userAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  userInitial: { color: colors.white, fontWeight: "800", fontSize: 13 },
  userMeta: { flex: 1 },
  userName: { fontSize: 13, fontWeight: "700", color: colors.textPrimary },
  userSub: { fontSize: 11, color: colors.textMuted },

  contentArea: { flex: 1, alignItems: "center" },
  contentInner: { flex: 1, width: "100%", maxWidth: 880, paddingHorizontal: spacing.xl },
});
