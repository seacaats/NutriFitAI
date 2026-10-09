import { useTheme } from "@/shared/context/ThemeContext";
import { colors, radii, spacing, typography } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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
        // The icon shows the current state: slashed while the password is hidden
        <Pressable
          onPress={onToggleVisible}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={visible ? "Hide password" : "Show password"}
        >
          <Ionicons name={visible ? "eye-outline" : "eye-off-outline"} size={iconSize} color={colors.green600} />
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

/**
 * FormInput's focus ring, for any other box: a green shadow on web, a green
 * 2px border on native, and no browser outline on the input itself.
 *
 *   const ring = useFocusRing();
 *   <View style={[styles.box, ring.style]}>
 *     <TextInput {...ring.handlers} style={[styles.input, ring.input]} />
 *   </View>
 */
export function useFocusRing() {
  const { tokens } = useTheme();
  const [focused, setFocused] = useState(false);
  const color = tokens.colors.focusRing;
  const web = Platform.OS === "web";
  return {
    focused,
    handlers: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
    style: focused ? (web ? { boxShadow: `0 0 0 2px ${color}` } : { borderColor: color, borderWidth: 2 }) : null,
    input: web ? { outlineStyle: "none" } : null,
  };
}

/**
 * A bordered TextInput that is its own box (profile fields, admin reason
 * boxes, schedule times). Takes every TextInput prop; onFocus / onBlur
 * still reach the caller
 */
export function RingInput({ style, onFocus, onBlur, ...props }) {
  const ring = useFocusRing();
  return (
    <TextInput
      {...props}
      style={[style, ring.input, ring.style]}
      onFocus={(e) => { ring.handlers.onFocus(); onFocus?.(e); }}
      onBlur={(e) => { ring.handlers.onBlur(); onBlur?.(e); }}
    />
  );
}

/**
 * The same ring for a box drawn in a list, where a hook per row can't be
 * called: `children` gets the ring and spreads it on its input
 *
 *   <RingField style={styles.box}>{(ring) => <TextInput {...ring.handlers} style={[styles.input, ring.input]} />}</RingField>
 */
export function RingField({ style, children }) {
  const ring = useFocusRing();
  return <View style={[style, ring.style]}>{children(ring)}</View>;
}

/**
 * Boxed, dismissible message for the auth forms.
 *
 * Renders nothing without a message. The X calls onDismiss, which the owning
 * screen/hook uses to clear its error state -- so the box stays gone until the
 * next failed submit sets a message again, rather than being hidden forever
 */
const TONES = {
  error: { icon: "alert-circle", fg: colors.danger, bg: colors.dangerBg },
  success: { icon: "checkmark-circle", fg: colors.green700, bg: colors.greenTint },
  info: { icon: "information-circle", fg: colors.textSecondary, bg: colors.white },
};

export function FormAlert({ message, onDismiss, tone = "error", style }) {
  if (!message) return null;
  const t = TONES[tone] || TONES.error;

  return (
    <View
      style={[alertStyles.box, { backgroundColor: t.bg, borderColor: t.fg }, style]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name={t.icon} size={18} color={t.fg} style={alertStyles.icon} />
      <Text style={[alertStyles.text, { color: t.fg }]}>{message}</Text>
      {onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="Dismiss message" style={alertStyles.close}>
          <Ionicons name="close" size={16} color={t.fg} />
        </Pressable>
      )}
    </View>
  );
}

const alertStyles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "flex-start",
    alignSelf: "stretch",
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: spacing.sm,
    gap: 8,
  },
  icon: { marginTop: 1 },
  text: { ...typography.caption, flex: 1, fontWeight: "600", lineHeight: 18 },
  close: { marginTop: 1 },
});