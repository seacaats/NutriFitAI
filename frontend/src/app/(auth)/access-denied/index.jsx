import { useAccessDenied } from "@/features/auth/hooks/useAccessDenied";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { useAuthColors } from "@/shared/context/ThemeContext";
import { radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AccessDeniedScreen() {
  const colors = useAuthColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { variant, handlePrimary, canSignOut, handleSignOut } = useAccessDenied();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Ionicons name={variant.icon} size={64} color={colors.primary} />
        </View>

        <Text style={styles.title}>{variant.title}</Text>
        <Text style={styles.subtitle}>{variant.body}</Text>

      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <PrimaryButton title={variant.action} onPress={handlePrimary} />

        {canSignOut && (
          <Pressable
            style={styles.signOutWrap}
            onPress={handleSignOut}
            hitSlop={8}
          >
            <Text style={styles.link}>Sign out</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMint },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },

  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: radii.pill,
    backgroundColor: colors.greenTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },

  title: { fontSize: 26, fontWeight: "800", color: colors.textPrimary, textAlign: "center" },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },

  footer: { paddingHorizontal: spacing.lg },
  signOutWrap: { alignSelf: "center", marginTop: spacing.md },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700" },
});