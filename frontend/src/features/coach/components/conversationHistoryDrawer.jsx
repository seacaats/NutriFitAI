import { colors, screenTones } from "@/shared/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import ConversationHistoryList from "./conversationHistoryList";

/**
 * Mobile entry point for chat history: a slide-in panel from the left edge,
 * the same pattern most chatbot apps use on a phone-width screen
 */
export default function ConversationHistoryDrawer({
  conversations, currentId, loading, onSelect, onNewChat, theme,
}) {
  const [open, setOpen] = useState(false);

  const t = {
    text: theme?.text ?? screenTones.light.text,
    bg: theme?.bg ?? colors.white,
    border: theme?.border ?? screenTones.light.border,
  };

  return (
    <>
      <Pressable hitSlop={8} onPress={() => setOpen(true)}>
        <Ionicons name="time-outline" size={20} color={t.text} />
      </Pressable>

      <Modal visible={open} transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

          <View style={[styles.panel, { backgroundColor: t.bg, borderRightColor: t.border }]}>
            <View style={[styles.header, { borderBottomColor: t.border }]}>
              <Text style={[styles.headerText, { color: t.text }]}>History</Text>
              <Pressable hitSlop={8} onPress={() => setOpen(false)}>
                <Ionicons name="close" size={20} color={t.text} />
              </Pressable>
            </View>

            <ConversationHistoryList
              conversations={conversations}
              currentId={currentId}
              loading={loading}
              onSelect={(id) => { setOpen(false); onSelect(id); }}
              onNewChat={() => { setOpen(false); onNewChat(); }}
              theme={theme}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: "row" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)" },
  panel: { width: 280, height: "100%", borderRightWidth: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerText: { fontSize: 15, fontWeight: "800" },
});