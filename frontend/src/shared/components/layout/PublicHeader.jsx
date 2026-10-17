import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import ThemeToggle from "@/shared/components/ui/ThemeToggle";
import { homeFor, useAuth } from "@/shared/context/AuthContext";
import { useAuthColors, useTheme } from "@/shared/context/ThemeContext";
import { colors, getPublicTones, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

const NAV_HEIGHT = 64;
// Same breakpoint as the landing page, below it the logo goes small
const WIDE = 900;

// Top bar for the public pages (logo left, buttons right)
export default function PublicHeader({ isAuthenticated = false }) {
  const router = useRouter();
  const { role } = useAuth();
  const { darkMode } = useTheme();
  const { width } = useWindowDimensions();
  const p = getPublicTones(darkMode);
  const styles = useMemo(() => createStyles(p), [p]);

  return (
    <View style={styles.nav}>
      <View style={styles.navInner}>
        <Pressable onPress={() => router.replace("/")} hitSlop={8}>
          <NutriFitLogo small={width < WIDE} />
        </Pressable>

        <View style={styles.navActions}>
          {isAuthenticated ? (
            <PrimaryButton title="Dashboard" onPress={() => router.push(homeFor(role))} style={styles.navBtn} />
          ) : (
            <>
              <Pressable onPress={() => router.push("/login")} hitSlop={8} style={({ hovered }) => [styles.navLink, hovered && styles.navLinkHover]}>
                <Text style={styles.navLinkText}>Log in</Text>
              </Pressable>
              <PrimaryButton title="Get started" onPress={() => router.push("/register")} style={styles.navBtn} />
            </>
          )}
          <ThemeToggle />
        </View>
      </View>
    </View>
  );
}

// Back arrow at the top of the auth screens: previous page, else the fallback
export function AuthBackLink({ fallback = "/" }) {
  const router = useRouter();
  const c = useAuthColors();
  const back = () => (router.canGoBack() ? router.back() : router.replace(fallback));

  return (
    <Pressable onPress={back} hitSlop={12} accessibilityLabel="Go back" style={styles.back}>
      <Ionicons name="chevron-back" size={20} color={c.brandDark} />
      <Text style={[styles.backText, { color: c.brandDark }]}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 2, marginBottom: spacing.md },
  backText: { ...typography.body, fontSize: 14, fontWeight: "600", color: colors.brandDark },
});

// Colors come from the public palette, so the header follows the light/dark theme
const createStyles = (p) => StyleSheet.create({
  nav: { backgroundColor: p.nav, borderBottomWidth: 1, borderBottomColor: p.line },
  navInner: { height: NAV_HEIGHT, width: "100%", maxWidth: 1120, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  navActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  navLink: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm },
  navLinkHover: { backgroundColor: p.hover },
  navLinkText: { ...typography.body, fontSize: 14, fontWeight: "600", color: p.ink },
  navBtn: { height: 38, minWidth: 0 },
});