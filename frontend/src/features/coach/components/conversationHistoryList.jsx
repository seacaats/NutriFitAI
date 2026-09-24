import { screenTones, shellColors } from "@/shared/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Pure list of recent threads — no chrome of its own, so it can sit inline in
 * a sidebar column (web) or inside a slide-over drawer (mobile)
 *
 * `conversations` is already newest-first and capped at 10 by the server
 * (updatedAt desc), so it's rendered as-is: row 0 is always the last
 * conversation the user touched
 */
export default function ConversationHistoryList({
  conversations, currentId, loading, onSelect, onNewChat, theme,
}) {
  const t = {
    text: theme?.text ?? screenTones.light.text,
    subtext: theme?.subtext ?? screenTones.light.muted,
    border: theme?.border ?? screenTones.light.border,
    activeBg: theme?.activeBg ?? shellColors.light.activeNavBg,
    primary: theme?.primary ?? shellColors.primary,
  };

  return (
    <View style={styles.flex1}>
      <Pressable onPress={onNewChat} style={[styles.newChatBtn, { borderColor: t.border }]}>
        <Ionicons name="add" size={16} color={t.primary} />
        <Text style={[styles.newChatText, { color: t.primary }]}>New chat</Text>
      </Pressable>

      {loading && conversations.length === 0 ? (
        <View style={styles.centerPad}><ActivityIndicator size="small" color={t.primary} /></View>
      ) : conversations.length === 0 ? (
        <View style={styles.centerPad}>
          <Text style={{ color: t.subtext, fontSize: 12 }}>No conversations yet.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const active = item.id === currentId;
            return (
              <Pressable
                onPress={() => onSelect(item.id)}
                style={[styles.row, active && { backgroundColor: t.activeBg }]}
              >
                <Text numberOfLines={1} style={[styles.rowTitle, { color: t.text }]}>
                  {item.title || "New conversation"}
                </Text>
                <Text style={[styles.rowDate, { color: t.subtext }]}>{formatWhen(item.updatedAt)}</Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

/** Short label — enough to distinguish rows, not a full timestamp */
function formatWhen(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  newChatBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginHorizontal: 12, marginTop: 12, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  newChatText: { fontSize: 13, fontWeight: "700" },
  listContent: { paddingHorizontal: 6, paddingTop: 6, paddingBottom: 12 },
  row: { paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, marginHorizontal: 6, marginVertical: 1 },
  rowTitle: { fontSize: 13, fontWeight: "500" },
  rowDate: { fontSize: 10, marginTop: 2 },
  centerPad: { padding: 20, alignItems: "center" },
});