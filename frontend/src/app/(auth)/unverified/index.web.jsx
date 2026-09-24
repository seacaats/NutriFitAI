import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifit";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function UnverifiedScreen() {
  const router = useRouter();
  const { email, message } = useLocalSearchParams();
  const reason = Array.isArray(message) ? message[0] : message;

  return (
    <View style={styles.flex}>
      <View style={styles.logoWrap}>
        <NutriFitLogo light small />
      </View>

      <View style={styles.center}>
        <View style={styles.card}>
          <Text style={styles.emoji}>❌</Text>
          <Text style={styles.title}>Verification Failed</Text>
          <Text style={styles.subtitle}>
            {reason || `Unable to verify your email.\nPlease try again.`}
          </Text>

          <PrimaryButton
            title="Retry"
            onPress={() => router.replace({ pathname: "/verify-registration", params: { email } })}
            style={styles.button}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgMint },
  logoWrap: { position: "absolute", top: 24, left: spacing.lg, zIndex: 1 },
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
  subtitle: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: 8, marginBottom: spacing.lg },
  button: { width: "100%" },
});