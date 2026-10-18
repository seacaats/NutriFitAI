import { useHeldWhileClosing } from "@/shared/hooks/useHeldWhileClosing";
import { getScreenTones, radii } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Shared dialog shell: a centered card on web, a bottom sheet on phones

export default function SheetModal({ visible, title, subtitle, onClose, footer, children, darkMode, wide = false }) {
  const tone = getScreenTones(darkMode);
  const web = Platform.OS === "web";
  // Each caller clears its routine or session as it closes; the last open
  // content stays up while the dialog leaves (like ConfirmModal)
  const shown = useHeldWhileClosing(visible, { title, subtitle, footer, children });
  // Phone sheets reach the screen edge: keep the last row clear of the
  // gesture bar, with the same breathing room as Browse's details
  const insets = useSafeAreaInsets();
  const sheetPad = web ? null : { paddingBottom: insets.bottom + (shown.footer ? 14 : 40) };

  return (
    // Never over another screen: hidden once you've navigated away
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, !web && styles.overlaySheet]}>
        {/* Tapping the dim background closes, like most modern dialogs */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />

        <View
          style={[
            styles.card,
            web ? [styles.cardWeb, wide && styles.cardWide] : styles.cardSheet,
            { backgroundColor: tone.card, borderColor: tone.border },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.flex1}>
              <Text style={[styles.title, { color: tone.text }]}>{shown.title}</Text>
              {!!shown.subtitle && <Text style={[styles.subtitle, { color: tone.muted }]}>{shown.subtitle}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close dialog">
              <Ionicons name="close" size={22} color={tone.muted} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, !shown.footer && sheetPad]} keyboardShouldPersistTaps="handled">
            {shown.children}
          </ScrollView>

          {!!shown.footer && <View style={[styles.footer, { borderTopColor: tone.border }, sheetPad]}>{shown.footer}</View>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 12 },
  overlaySheet: { justifyContent: "flex-end", padding: 0 },
  card: { borderWidth: 1, overflow: "hidden" },
  cardWeb: { width: "100%", maxWidth: 520, maxHeight: "90%", borderRadius: radii.lg },
  cardWide: { maxWidth: 720 },
  cardSheet: { width: "100%", maxHeight: "92%", borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  flex1: { flex: 1 },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
  footer: { flexDirection: "row", gap: 10, justifyContent: "flex-end", paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1 },
});
