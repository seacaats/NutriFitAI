import { useTheme } from "@/shared/context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";

export default function FormInput({
  icon,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  showToggle = false,
  visible = false,
  onToggleVisible,
  keyboardType = "default",
  autoCapitalize = "sentences",
  style,
  size = "md",
}) {
  const { tokens } = useTheme();
  const { colors, radii } = tokens;
  const styles = useMemo(() => createStyles(colors, radii), [colors, radii]);

  const [focused, setFocused] = useState(false);
  const iconSize = size === "sm" ? 14 : 16;

  return (
    <View style={[styles.wrapper, focused && styles.wrapperFocused, style]}>
      {icon && <Ionicons name={icon} size={iconSize} color={colors.green600} style={styles.leftIcon} />}
      <TextInput
        style={[styles.input, size === "sm" && styles.inputSm]}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !visible}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {showToggle && (
        <Pressable onPress={onToggleVisible} hitSlop={10}>
          <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={iconSize} color={colors.green600} />
        </Pressable>
      )}
    </View>
  );
}

function createStyles(colors, radii) {
  return StyleSheet.create({
    wrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.inputBg,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      height: 42,
    },
    wrapperFocused: Platform.OS === "web"
      ? { boxShadow: `0 0 0 2px ${colors.focusRing}` }
      : { borderColor: colors.focusRing, borderWidth: 2 },
    leftIcon: { marginRight: 8 },
    input: { flex: 1, fontSize: 14, color: colors.textPrimary, ...(Platform.OS === "web" ? { outlineStyle: "none" } : null) },
    inputSm: { fontSize: 12 },
  });
}
