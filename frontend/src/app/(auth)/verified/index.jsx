import NutriFitLogo from "@/shared/components/ui/NutriFitLogo";
import PrimaryButton from "@/shared/components/ui/PrimaryButton";
import { colors, radii, spacing } from "@/shared/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function VerifiedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.brandRow}>
        <NutriFitLogo small />
      </View>

      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark-circle" size={72} color={colors.primary} />
        </View>

        <Text style={styles.title}>Verified!</Text>
        <Text style={styles.subtitle}>You have successfully verified your email.</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <PrimaryButton title="Get Started" onPress={() => router.replace("/login")} />
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
    backgroundColor: colors.greenTint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },

  title: { fontSize: 26, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm },

  footer: { paddingHorizontal: spacing.lg },
});