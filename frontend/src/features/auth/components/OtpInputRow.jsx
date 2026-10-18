import { useAuthColors, useTheme } from "@/shared/context/ThemeContext";
import { spacing, typography } from "@/shared/theme/nutrifitai";
import { useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";

// `onSubmit` lets Enter in any digit box submit the code
export default function OtpInputRow({ otp, variant = "green500", onSubmit }) {
  const { tokens } = useTheme();
  const { radii } = tokens;
  const colors = useAuthColors(tokens.colors);
  const styles = useMemo(() => createStyles(colors, radii), [colors, radii]);

  const [focusedIndex, setFocusedIndex] = useState(null);
  const ringColor = variant === "primaryBorder" ? colors.primary : colors.focusRing;

  return (
    <View style={styles.row}>
      {otp.code.map((digit, index) => {
        const isFocused = focusedIndex === index;
        return (
          <TextInput
            key={index}
            ref={otp.setInputRef(index)}
            style={[
              styles.box,
              isFocused && getFocusStyle(ringColor, variant === "primaryBorder"),
            ]}
            value={digit}
            onChangeText={(val) => otp.handleChange(val, index)}
            onKeyPress={(e) => otp.handleKeyPress(e, index)}
            onSubmitEditing={onSubmit}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex((cur) => (cur === index ? null : cur))}
            keyboardType="number-pad"
            maxLength={1}
          />
        );
      })}
    </View>
  );
}


function getFocusStyle(ringColor, alsoChangeBorder) {
  if (Platform.OS === "web") {
    return {
      boxShadow: `0 0 0 2px ${ringColor}`,
      // The gray 1px border would otherwise show as a dark line inside the ring
      borderColor: alsoChangeBorder ? ringColor : "transparent",
    };
  }
  return { borderColor: ringColor, borderWidth: 2 };
}

function createStyles(colors, radii) {
  return StyleSheet.create({
    row: { flexDirection: "row", justifyContent: "center", gap: 12 },
    box: {
      width: 56,
      height: 56,
      textAlign: "center",
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
      // The browser's own focus outline drew a black ring inside the green
      // one; the ring from getFocusStyle is the only focus mark
      ...(Platform.OS === "web" ? { outlineStyle: "none" } : null),
    },
  });
}

/**
 * "Didn't get the code? Resend it or update your email address."
 * Both actions are inline links. Shared by the registration, password-reset
 * and sign-in OTP screens (web + native)
 */
export function OtpHelpLine({ onResend, onUpdateEmail, resending = false, cooldown = 0, style }) {
  const helpLineStyles = useHelpLineStyles();
  const resendDisabled = resending || cooldown > 0;
  const resendLabel = resending ? "Sending..." : cooldown > 0 ? `Resend it (${cooldown}s)` : "Resend it";

  return (
    <Text style={[helpLineStyles.line, style]}>
      Didn't get the code?{" "}
      <Text
        onPress={resendDisabled ? undefined : onResend}
        style={[helpLineStyles.link, resendDisabled && helpLineStyles.linkDisabled]}
        accessibilityRole="link"
      >
        {resendLabel}
      </Text>
      {/* No email to change on the sign-in screen, so that part is optional */}
      {onUpdateEmail ? (
        <>
          {" "}or{" "}
          <Text onPress={onUpdateEmail} style={helpLineStyles.link} accessibilityRole="link">
            update your email address
          </Text>
        </>
      ) : null}
      .
    </Text>
  );
}

const createHelpLineStyles = (colors) => StyleSheet.create({
  line: { ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.md },
  link: { ...typography.caption, color: colors.green700, fontWeight: "700", textDecorationLine: "underline" },
  linkDisabled: { color: colors.textMuted, textDecorationLine: "none" },
});

const useHelpLineStyles = () => {
  const colors = useAuthColors();
  return useMemo(() => createHelpLineStyles(colors), [colors]);
};