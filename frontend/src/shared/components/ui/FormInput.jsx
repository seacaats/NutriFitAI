import { useAuthColors, useTheme } from "@/shared/context/ThemeContext";
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
  // Style for the input box itself when a label wraps it (e.g. a tinted fill)
  boxStyle,
  size = "md",
  // Label above the box: a red * when required, "(Optional)" when optional
  label,
  required = false,
  optional = false,
  // Code fields: length cap, one-time-code autofill, Enter to submit
  maxLength,
  autoComplete,
  textContentType,
  autoFocus = false,
  onSubmitEditing,
}) {
  const { tokens } = useTheme();
  const { radii } = tokens;
  // The dark-aware palette on the auth screens, the theme's own elsewhere
  const colors = useAuthColors(tokens.colors);
  const styles = useMemo(() => createStyles(colors, radii), [colors, radii]);

  const [focused, setFocused] = useState(false);
  const iconSize = size === "sm" ? 14 : 16;

  // Without a label the box takes `style` itself; with one, `style` moves to
  // the label + box wrapper so spacing and row widths still apply
  const box = (
    <View style={[styles.wrapper, focused && styles.wrapperFocused, boxStyle, !label && style]}>
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
        maxLength={maxLength}
        autoComplete={autoComplete}
        textContentType={textContentType}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmitEditing}
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

  if (!label) return box;
  return (
    <View style={style}>
      <FieldLabel label={label} required={required} optional={optional} />
      {box}
    </View>
  );
}

/**
 * Label for a field: a red asterisk marks it required, "(Optional)" marks
 * it optional, and a field with neither gets no marker
 */
export function FieldLabel({ label, required = false, optional = false, style }) {
  const c = useAuthColors();
  return (
    <Text style={[labelStyles.label, { color: c.textSecondary }, style]}>
      {label}
      {required && <Text style={labelStyles.required}> *</Text>}
      {optional && <Text style={[labelStyles.optional, { color: c.textMuted }]}> (Optional)</Text>}
    </Text>
  );
}

const labelStyles = StyleSheet.create({
  label: { ...typography.bodyBold, color: colors.textSecondary, marginBottom: 6 },
  required: { color: colors.danger },
  optional: { fontWeight: "400", color: colors.textMuted },
});

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
    input: { flex: 1, minWidth: 0, fontSize: 14, color: colors.textPrimary, ...(Platform.OS === "web" ? { outlineStyle: "none" } : null) },
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
const getTones = (c) => ({
  // Only errors carry an icon (the X); success and info are text only
  error: { icon: "close-circle", fg: c.danger, bg: c.dangerBg },
  success: { icon: null, fg: c.green700, bg: c.greenTint },
  info: { icon: null, fg: c.textSecondary, bg: c.white },
});

export function FormAlert({ message, onDismiss, tone = "error", style }) {
  const c = useAuthColors();
  if (!message) return null;
  const tones = getTones(c);
  const t = tones[tone] || tones.error;

  return (
    <View
      style={[alertStyles.box, { backgroundColor: t.bg, borderColor: t.fg }, style]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {t.icon && <Ionicons name={t.icon} size={18} color={t.fg} style={alertStyles.icon} />}
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