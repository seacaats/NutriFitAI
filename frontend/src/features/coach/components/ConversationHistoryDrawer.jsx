import { colors, screenTones } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ConversationHistoryList from "./ConversationHistoryList";

const PANEL_WIDTH = 280;

/**
 * Mobile entry point for chat history: a slide-in panel from the right edge,
 * the same pattern most chatbot apps use on a phone-width screen
 */
export default function ConversationHistoryDrawer({
  conversations, currentId, loading, onSelect, onNewChat, onDelete, onDeleteAll, theme,
}) {
  const [open, setOpen] = useState(false);
  // The panel is full height, so it keeps clear of the notch and home bar
  const insets = useSafeAreaInsets();
  // Kept mounted until the close animation ends
  const [mounted, setMounted] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  // Same motion as the dashboard menu: the backdrop fades in place while
  // the panel slides in from the right. Opening mounts the Modal first and
  // only animates once it's on screen
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    // Nothing to close on first render. Animating here anyway ran a native
    // animation during the screen's own slide-in and cancelled it
    if (!mounted) return;
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [open, mounted, anim]);

  useEffect(() => {
    if (!open || !mounted) return;
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, mounted, anim]);

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

      {/* Built like the dashboard's ☰ sheet: both layers sit directly in the
          Modal, and the panel is pinned to the right edge */}
      <Modal visible={mounted} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: anim }]}>
          <Pressable style={styles.flex1} onPress={() => setOpen(false)} accessibilityLabel="Close history" />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            { backgroundColor: t.bg, borderLeftColor: t.border, paddingTop: insets.top, paddingBottom: insets.bottom },
            { transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [PANEL_WIDTH, 0] }) }] },
          ]}
        >
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
            onDelete={onDelete}
            onDeleteAll={onDeleteAll}
            theme={theme}
          />
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  backdrop: { backgroundColor: "rgba(0,0,0,0.25)" },
  panel: { position: "absolute", top: 0, right: 0, bottom: 0, width: PANEL_WIDTH, borderLeftWidth: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  headerText: { fontSize: 15, fontWeight: "800" },
});