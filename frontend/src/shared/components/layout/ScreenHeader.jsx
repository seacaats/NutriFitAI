import { useOpenMenu } from "@/shared/components/layout/DashboardLayout";
import { useTheme } from "@/shared/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

// Back arrow + centered title (and a short subtitle) for mobile screens opened from the ☰ menu,
// which hide the bottom bar. Back goes to the previous screen, or `fallback`
// when there isn't one (e.g. opened straight from a link).
// Without a `right`, the ☰ menu sits there, so the menu is never out of reach
export default function ScreenHeader({ title, subtitle = null, right, fallback = "/dashboard" }) {
  const router = useRouter();
  const { shell: c } = useTheme();
  const rightSlot = right === undefined ? <MenuButton /> : right;

  const back = () => (router.canGoBack() ? router.back() : router.replace(fallback));

  return (
    <View style={styles.header}>
      <Pressable onPress={back} style={styles.side} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="arrow-back" size={22} color={c.sidebarText} />
      </Pressable>
      <View style={styles.center}>
        <Text style={[styles.title, { color: c.sidebarText }]} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={[styles.subtitle, { color: c.inactiveNavText }]} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {/* Same width as the back button, so the title stays centered */}
      <View style={[styles.side, styles.right]}>{rightSlot}</View>
    </View>
  );
}

// ☰ for screens without the bottom bar. Renders nothing outside a
// DashboardLayout, so a header spacer can always hold it
export function MenuButton() {
  const { shell: c } = useTheme();
  const openMenu = useOpenMenu();
  if (!openMenu) return null;
  return (
    <Pressable onPress={openMenu} hitSlop={8} accessibilityRole="button" accessibilityLabel="Open menu">
      <Ionicons name="menu" size={24} color={c.sidebarText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  side: { width: 40, height: 40, justifyContent: "center" },
  right: { alignItems: "flex-end" },
  center: { flex: 1, alignItems: "center" },
  title: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 12, marginTop: 2, textAlign: "center" },
});