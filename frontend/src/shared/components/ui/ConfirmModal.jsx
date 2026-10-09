import { useTheme } from "@/shared/context/ThemeContext";
import { useHeldWhileClosing } from "@/shared/hooks/useHeldWhileClosing";
import { colors, getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

// One confirmation dialog for the whole app, in two flavours:
//   tone="danger"   red, for deletes            ("Delete" + "Back")
//   tone="confirm"  green, for saves and edits  ("Update"/"Create"/... + "Back")
// `children` is optional extra content (e.g. a form) shown above the buttons.
// While `loading`, both buttons are disabled and the dialog can't be dismissed

const TONES = {
  danger: { color: colors.danger, icon: "trash-outline", label: "Delete" },
  confirm: { color: shellColors.primary, icon: "checkmark-circle-outline", label: "Confirm" },
};

export default function ConfirmModal({
  visible,
  tone = "confirm",
  title,
  message,
  confirmLabel,
  cancelLabel = "Back",
  onConfirm,
  onCancel,
  loading = false,
  confirmDisabled = false,
  children,
}) {
  const { darkMode } = useTheme();
  const palette = getScreenTones(darkMode);

  // Callers usually clear what the dialog shows (the item being deleted, its
  // name) in the same moment they close it. Keep the last open content while
  // the fade-out plays, so the text doesn't blink away before the dialog does
  const shown = useHeldWhileClosing(visible, { tone, title, message, confirmLabel, cancelLabel, children });

  const t = TONES[shown.tone] || TONES.confirm;
  const close = () => !loading && onCancel?.();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${t.color}1f` }]}>
            <Ionicons name={t.icon} size={24} color={t.color} />
          </View>

          <Text style={[styles.title, { color: palette.text }]}>{shown.title}</Text>
          {!!shown.message && <Text style={[styles.message, { color: palette.muted }]}>{shown.message}</Text>}

          {shown.children ? <View style={styles.body}>{shown.children}</View> : null}

          <View style={styles.actions}>
            <Pressable
              onPress={close}
              disabled={loading}
              accessibilityRole="button"
              style={[styles.button, styles.back, { borderColor: palette.border, opacity: loading ? 0.5 : 1 }]}
            >
              <Text style={[styles.buttonText, { color: palette.text }]}>{shown.cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={loading || confirmDisabled}
              accessibilityRole="button"
              style={[styles.button, { backgroundColor: t.color, opacity: confirmDisabled ? 0.5 : 1 }]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={[styles.buttonText, styles.confirmText]}>{shown.confirmLabel || t.label}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 400, borderWidth: 1, borderRadius: radii.md, padding: 20, alignItems: "center" },
  iconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "800", textAlign: "center" },
  message: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6 },
  body: { alignSelf: "stretch", marginTop: 14 },
  actions: { flexDirection: "row", gap: 10, marginTop: 18, alignSelf: "stretch" },
  button: { flex: 1, minHeight: 42, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  back: { borderWidth: 1 },
  buttonText: { fontSize: 14, fontWeight: "800" },
  confirmText: { color: "#ffffff" },
});