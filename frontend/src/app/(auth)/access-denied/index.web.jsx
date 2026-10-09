import { useAccessDenied } from "@/features/auth/hooks/useAccessDenied";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function AccessDeniedScreen() {
  const { variant, handlePrimary, canSignOut, handleSignOut } = useAccessDenied();

  return (
    <View style={styles.flex}>
      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.emoji}>{variant.emoji}</Text>
          <Text style={styles.title}>{variant.title}</Text>
          <Text style={styles.subtitle}>{variant.body}</Text>

          <PrimaryButton title={variant.action} onPress={handlePrimary} style={styles.button} />

          {canSignOut && (
            <Pressable onPress={handleSignOut}>
              <Text style={styles.link}>Sign out</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgMint },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.xl,
    alignItems: "center",
  },
  emoji: { fontSize: 40, marginBottom: spacing.sm },
  title: { ...typography.h3, color: colors.textPrimary },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 8,
    marginBottom: spacing.lg,
  },
  button: { width: "100%" },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700", marginTop: spacing.md },
});