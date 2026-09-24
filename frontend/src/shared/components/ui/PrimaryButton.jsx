import { useTheme } from "@/shared/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

export default function PrimaryButton({ title, onPress, icon, loading = false, disabled = false, style }) {
  const { tokens } = useTheme();
  const { colors, radii, typography } = tokens;
  const styles = useMemo(() => createStyles(colors, radii, typography), [colors, radii, typography]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={16} color={colors.white} style={styles.icon} />}
          <Text style={styles.text}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

function createStyles(colors, radii, typography) {
  return StyleSheet.create({
    base: {
      flexDirection: "row",
      height: 44,
      borderRadius: radii.sm,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
    },
    pressed: { backgroundColor: colors.primaryDark },
    disabled: { opacity: 0.6 },
    icon: { marginRight: 8 },
    text: { ...typography.button, color: colors.white },
  });
}