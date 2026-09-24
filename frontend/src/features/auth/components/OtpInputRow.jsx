import { useTheme } from "@/shared/context/ThemeContext";
import { useMemo, useState } from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";

export default function OtpInputRow({ otp, variant = "green500" }) {
  const { tokens } = useTheme();
  const { colors, radii } = tokens;
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
      ...(alsoChangeBorder ? { borderColor: ringColor } : null),
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
      backgroundColor: colors.white,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.sm,
    },
  });
}
