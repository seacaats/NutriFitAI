import PrimaryButton from "@/components/nutrifit/PrimaryButton";
import { useOtpInput } from "@/hooks/use-otp-input";
import { colors, radii, spacing, typography } from "@/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

export default function VerifyScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const otp = useOtpInput(4);
  const [loading, setLoading] = useState(false);

  const handleVerify = () => {
    setLoading(true);
    // mock verification call
    setTimeout(() => {
      setLoading(false);
      router.replace("/(tabs)/home");
    }, 800);
  };

  return (
    <View style={styles.flex}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.logoCircle}>
            <Ionicons name="barbell-outline" size={20} color={colors.white} />
          </View>
          <Text style={styles.brand}>NutriFit AI</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark-outline" size={40} color={colors.white} />
          </View>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            Please enter the 4 digit code sent to{"\n"}
            {email || "yourmail@gmail.com"}
          </Text>

          <View style={styles.codeRow}>
            {otp.code.map((digit, idx) => (
              <TextInput
                key={idx}
                ref={otp.setInputRef(idx)}
                style={styles.codeBox}
                value={digit}
                onChangeText={(val) => otp.handleChange(val, idx)}
                keyboardType="number-pad"
                maxLength={1}
              />
            ))}
          </View>

          <Text style={styles.resendPrompt}>Didn't receive the code?</Text>
          <Pressable disabled={!otp.canResend} onPress={otp.resend}>
            <Text style={styles.resendLink}>Resend{!otp.canResend ? `(${otp.seconds}s)` : ""}</Text>
          </Pressable>
        </View>

        <PrimaryButton title="Verify" onPress={handleVerify} loading={loading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgMint },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    justifyContent: "space-between",
    paddingBottom: 60,
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  logoCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 10 },
  checkCircle: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: spacing.md},
  brand: { ...typography.h3, color: colors.primaryLight },
  body: { alignItems: "center" },
  title: { ...typography.h2, marginBottom: 12 },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.xl },
  codeRow: { flexDirection: "row", gap: 14, marginBottom: spacing.xl },
  codeBox: {
    width: 60,
    height: 68,
    borderRadius: radii.md,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  resendPrompt: { color: colors.textSecondary, marginBottom: 4 },
  resendLink: { color: colors.primary, fontWeight: "700" },
});