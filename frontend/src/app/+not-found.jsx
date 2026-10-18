import ActionButton from "@/shared/components/ui/ActionButton";
import { homeFor, useAuth } from "@/shared/context/AuthContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { getPublicTones, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Shown for any URL that matches no screen (a static export also writes it as 404.html)
export default function NotFoundScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { darkMode } = useTheme();
  const { isAuthenticated, role } = useAuth();
  const p = getPublicTones(darkMode);
  const styles = useMemo(() => createStyles(p), [p]);

  // Signed in goes to their own home, everyone else to the landing page
  const home = () => router.replace(isAuthenticated ? homeFor(role) : "/");

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.body}>
        <View style={styles.icon}>
          <Ionicons name="compass-outline" size={34} color={p.accent} />
        </View>
        <Text style={styles.code}>404</Text>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.text}>The page you're looking for doesn't exist or has moved.</Text>
        <ActionButton label={isAuthenticated ? "Back to my dashboard" : "Back to home"} onPress={home} darkMode={darkMode} />
      </View>
    </View>
  );
}

const createStyles = (p) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: p.bg },
    body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg, gap: spacing.sm },
    icon: { width: 72, height: 72, borderRadius: radii.xl, alignItems: "center", justifyContent: "center", backgroundColor: p.soft, marginBottom: spacing.sm },
    code: { ...typography.brandHeading, color: p.accent },
    title: { ...typography.h1, color: p.title },
    text: { ...typography.body, color: p.text, textAlign: "center", maxWidth: 360, marginBottom: spacing.md },
  });