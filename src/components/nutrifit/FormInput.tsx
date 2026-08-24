import { colors, radii } from "@/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { KeyboardTypeOptions, Pressable, StyleProp, StyleSheet, TextInput, View, ViewStyle } from "react-native";

type Props = {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  showToggle?: boolean;
  visible?: boolean;
  onToggleVisible?: () => void;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  style?: StyleProp<ViewStyle>;
};

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
}: Props) {
  return (
    <View style={[styles.wrapper, style]}>
      {icon && <Ionicons name={icon} size={20} color={colors.primary} style={styles.leftIcon} />}
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !visible}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
      {showToggle && (
        <Pressable onPress={onToggleVisible} hitSlop={10}>
          <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={20} color={colors.primary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    height: 56,
  },
  leftIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: colors.textPrimary },
});
