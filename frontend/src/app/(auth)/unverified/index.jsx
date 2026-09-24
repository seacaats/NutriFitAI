import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing } from "@/shared/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UnverifiedScreen() {
  const router = useRouter();
  const { email, message } = useLocalSearchParams();
  const reason = Array.isArray(message) ? message[0] : message;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.brandRow}>
        <NutriFitLogo small />
      </View>

      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Ionicons name="close-circle" size={72} color={colors.danger} />
        </View>

        <Text style={styles.title}>Verification Failed</Text>
        <Text style={styles.subtitle}>
          {reason || "Unable to verify your email. Please try again."}
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <PrimaryButton
          title="Retry"
          onPress={() => router.replace({ pathname: "/verify-registration", params: { email } })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMint },
  brandRow: { paddingTop: spacing.sm, paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },

  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: radii.pill,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },

  title: { fontSize: 26, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },

  footer: { paddingHorizontal: spacing.lg },
});