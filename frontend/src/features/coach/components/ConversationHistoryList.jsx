import { MAX_CONVERSATIONS } from "@/features/coach/hooks/useCoachChat";
import Skeleton from "@/shared/components/Skeleton";
import ConfirmModal from "@/shared/components/ui/ConfirmModal";
import { screenTones, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * Pure list of recent threads — no chrome of its own, so it can sit inline in
 * a sidebar column (web) or inside a slide-over drawer (mobile)
 *
 * `conversations` is already newest-first (updatedAt desc), so it's rendered
 * as-is: row 0 is always the last conversation the user touched. A user can
 * keep MAX_CONVERSATIONS of them; the footer says so and offers "Delete all"
 */
export default function ConversationHistoryList({
  conversations, currentId, loading, onSelect, onNewChat, onDelete, onDeleteAll, theme,
}) {
  // { id, title } for one conversation, or { all: true }
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmDelete() {
    setBusy(true);
    try {
      if (pending.all) await onDeleteAll?.();
      else await onDelete?.(pending.id);
      setPending(null);
      setError("");
    } catch (err) {
      setError(err?.message || "Couldn't delete that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

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
        // First load only: rows in the list's own row style and line heights
        <View style={styles.listContent}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.row}>
              <View style={styles.flex1}>
                <Skeleton width="75%" height={17} />
                <Skeleton width="35%" height={13} style={{ marginTop: 2 }} />
              </View>
            </View>
          ))}
        </View>
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
                <View style={styles.flex1}>
                  <Text numberOfLines={1} style={[styles.rowTitle, { color: t.text }]}>
                    {item.title || "New conversation"}
                  </Text>
                  <Text style={[styles.rowDate, { color: t.subtext }]}>{formatWhen(item.updatedAt)}</Text>
                </View>
                {onDelete && (
                  <Pressable
                    onPress={() => setPending({ id: item.id, title: item.title })}
                    hitSlop={8}
                    style={styles.trash}
                    accessibilityLabel="Delete conversation"
                  >
                    <Ionicons name="trash-outline" size={15} color={t.subtext} />
                  </Pressable>
                )}
              </Pressable>
            );
          }}
        />
      )}

      {/* Limit note, and clearing everything at once */}
      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <Text style={[styles.note, { color: t.subtext }]}>
          {conversations.length} of {MAX_CONVERSATIONS} conversations
        </Text>
        {onDeleteAll && conversations.length > 0 && (
          <Pressable onPress={() => setPending({ all: true })} hitSlop={6} style={styles.deleteAll}>
            <Ionicons name="trash-outline" size={14} color={t.subtext} />
            <Text style={[styles.deleteAllText, { color: t.subtext }]}>Delete all</Text>
          </Pressable>
        )}
      </View>

      <ConfirmModal
        visible={Boolean(pending)}
        tone="danger"
        title={pending?.all ? "Delete all conversations?" : "Delete this conversation?"}
        message={error || (pending?.all
          ? `All ${conversations.length} conversations and their messages will be deleted.`
          : `"${pending?.title || "New conversation"}" and its messages will be deleted.`)}
        confirmLabel={pending?.all ? "Delete all" : "Delete"}
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => { setPending(null); setError(""); }}
      />
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
  row: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8, marginHorizontal: 6, marginVertical: 1,
  },
  trash: { padding: 4 },
  footer: { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  note: { fontSize: 11, lineHeight: 16, textAlign: "center" },
  deleteAll: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "center" },
  deleteAllText: { fontSize: 12, fontWeight: "700" },
  rowTitle: { fontSize: 13, fontWeight: "500" },
  rowDate: { fontSize: 10, marginTop: 2 },
  centerPad: { padding: 20, alignItems: "center" },
});