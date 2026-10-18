import Skeleton from "@/shared/components/Skeleton";
import { RingInput } from "@/shared/components/ui/FormInput";
import { colors, radii } from "@/shared/theme/nutrifitai";
import { formatTimestamp } from "@/shared/utils/formatDate";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * The drawer's notes thread and hold control for one row. Its own component
 * so each open drawer keeps its own draft and status.
 *
 * Notes: admins and superadmins, append-only (a correction is a new note).
 * Hold: superadmin only, needs a reason, and is itself audited
 */
export default function RowNotesAndHold({ row, log, isSuper, tone }) {
  const [notes, setNotes] = useState(null);
  const [draft, setDraft] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  // listNotes is stable (useCallback), so this refetches only when the row
  // or its note count changes, not on every parent render
  const { listNotes } = log;
  useEffect(() => {
    let cancelled = false;
    listNotes(row.id)
      .then((data) => { if (!cancelled) setNotes(data); })
      .catch(() => { if (!cancelled) setNotes([]); });
    return () => { cancelled = true; };
  }, [row.id, row.noteCount, listNotes]);

  const submit = async (action) => {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setNotice(result);
    if (result.ok) { setDraft(""); setReason(""); }
  };

  return (
    <View style={[styles.notesBox, { borderColor: tone.border }]}>
      <Text style={[styles.heading, { color: tone.muted }]}>NOTES</Text>
      {notes === null ? (
        <View style={styles.noteSkeleton}>
          <Skeleton width="40%" height={11} />
          <Skeleton width="85%" height={12} />
        </View>
      ) : notes.length === 0 ? (
        <Text style={[styles.noteMeta, { color: tone.muted }]}>No notes yet.</Text>
      ) : (
        notes.map((note) => (
          <View key={note.id} style={styles.note}>
            <Text style={[styles.noteMeta, { color: tone.muted }]}>
              {note.author || "Unknown"} · {formatTimestamp(note.createdAt)}
            </Text>
            <Text selectable style={[styles.noteBody, { color: tone.text }]}>{note.body}</Text>
          </View>
        ))
      )}
      <View style={styles.noteForm}>
        <RingInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Add a note for other admins"
          placeholderTextColor={tone.muted}
          multiline
          maxLength={1000}
          style={[styles.noteInput, { backgroundColor: tone.card, borderColor: tone.border, color: tone.text }]}
        />
        <Pressable
          onPress={() => submit(() => log.addNote(row.id, draft.trim()))}
          disabled={busy || !draft.trim()}
          style={[styles.smallBtn, { borderColor: tone.border }, (busy || !draft.trim()) && styles.disabled]}
        >
          <Text style={[styles.smallBtnText, { color: tone.text }]}>Add note</Text>
        </Pressable>
      </View>

      {isSuper && (
        <View style={[styles.holdRow, { borderTopColor: tone.border }]}>
          <Text style={[styles.noteMeta, { color: tone.muted }]}>
            {row.held
              ? "Held: this entry is kept after it expires."
              : "Hold this entry to keep it after it expires."}
          </Text>
          <View style={styles.noteForm}>
            <RingInput
              value={reason}
              onChangeText={setReason}
              placeholder={row.held ? "Reason for releasing (required)" : "Reason for holding (required)"}
              placeholderTextColor={tone.muted}
              // Same box as the note above: wraps, then scrolls
              multiline
              maxLength={300}
              style={[styles.noteInput, { backgroundColor: tone.card, borderColor: tone.border, color: tone.text }]}
            />
            <Pressable
              onPress={() => submit(() => (row.held ? log.release(row.id, reason.trim()) : log.hold(row.id, reason.trim())))}
              disabled={busy || reason.trim().length < 3}
              style={[styles.smallBtn, { borderColor: tone.border }, (busy || reason.trim().length < 3) && styles.disabled]}
            >
              <Text style={[styles.smallBtnText, { color: tone.text }]}>{row.held ? "Release hold" : "Hold"}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {notice && (
        <Text style={[styles.noteMeta, { color: notice.ok ? tone.muted : colors.danger }]}>{notice.message}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  notesBox: { borderWidth: 1, borderRadius: radii.sm, padding: 12, gap: 8 },
  note: { gap: 2 },
  noteMeta: { fontSize: 11 },
  noteBody: { fontSize: 13, lineHeight: 18 },
  noteForm: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 8 },
  noteInput: { flexGrow: 1, flexBasis: 220, minWidth: 0, borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  smallBtn: { borderWidth: 1, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 9 },
  smallBtnText: { fontSize: 12, fontWeight: "700" },
  holdRow: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  noteSkeleton: { gap: 6 },
  disabled: { opacity: 0.5 },
});
