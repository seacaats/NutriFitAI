import { VOICE_LANGUAGES } from "@/features/coach/hooks/useCoachChat";
import { useTheme } from "@/shared/context/ThemeContext";
import { getScreenTones, radii, shellColors } from "@/shared/theme/nutrifitai";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

// Which language the mic listens for. A small pill under the input opens a
// searchable list; Auto lets Whisper detect it. Hidden while recording.
// `inline` is the plain icon that sits beside the input box, next to the mic.
// It turns green once a language is picked, so Auto looks different from a pinned one
export default function VoiceLanguagePicker({ voice, inline = false }) {
  const { darkMode } = useTheme();
  const palette = getScreenTones(darkMode);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const current = VOICE_LANGUAGES.find((l) => l.code === voice.language) || VOICE_LANGUAGES[0];
  // Matches anywhere in the name, so "tag" finds Filipino (Tagalog)
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? VOICE_LANGUAGES.filter((l) => l.label.toLowerCase().includes(q)) : VOICE_LANGUAGES;
  }, [query]);

  if (!voice.supported || voice.listening || voice.transcribing) return null;

  const close = () => { setOpen(false); setQuery(""); };
  const pick = (code) => { voice.setLanguage(code); close(); };

  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityLabel={`Voice language: ${current.label}. Change`} style={[styles.pill, { borderColor: palette.border }, inline && styles.pillInline]}>
        <Ionicons name="language-outline" size={inline ? 22 : 14} color={inline && voice.language !== "auto" ? shellColors.primary : palette.muted} />
        {!inline && <Text style={[styles.pillText, { color: palette.muted }]} numberOfLines={1}>{current.label}</Text>}
        {!inline && <Ionicons name="chevron-down" size={12} color={palette.muted} />}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />

          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.header}>
              <View style={styles.flex1}>
                <Text style={[styles.title, { color: palette.text }]}>Voice language</Text>
                <Text style={[styles.hint, { color: palette.muted }]}>Change to your preferred language for the best results.</Text>
              </View>
              <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close dialog">
                <Ionicons name="close" size={22} color={palette.muted} />
              </Pressable>
            </View>

            <View style={[styles.search, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
              <Ionicons name="search" size={16} color={palette.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search languages"
                placeholderTextColor={palette.muted}
                autoCorrect={false}
                autoCapitalize="none"
                style={[styles.input, { color: palette.text }]}
              />
              {!!query && (
                <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={16} color={palette.muted} />
                </Pressable>
              )}
            </View>

            <FlatList
              data={results}
              keyExtractor={(l) => l.code}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              ListEmptyComponent={<Text style={[styles.empty, { color: palette.muted }]}>No language found.</Text>}
              renderItem={({ item }) => {
                const on = item.code === voice.language;
                return (
                  <Pressable onPress={() => pick(item.code)} accessibilityState={{ selected: on }} style={({ hovered }) => [styles.row, (on || hovered) && { backgroundColor: palette.soft }]}>
                    <Text style={[styles.rowText, { color: palette.text }, on && styles.rowTextOn]}>{item.label}</Text>
                    {on && <Ionicons name="checkmark" size={18} color={shellColors.primary} />}
                  </Pressable>
                );
              }}
            />

            {/* Voice isn't perfect, so say so */}
            <View style={[styles.note, { borderTopColor: palette.border }]}>
              <Ionicons name="information-circle-outline" size={16} color={palette.muted} />
              <Text style={[styles.noteText, { color: palette.muted }]}>Voice input may not catch every word, especially in some languages. Check your message before sending.</Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 5, marginTop: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  // Icon only: same size as the mic, at the bottom of the row beside the input box (50 tall)
  pillInline: { alignSelf: "flex-end", justifyContent: "center", marginTop: 0, width: 36, height: 50, borderWidth: 0, paddingVertical: 0, paddingHorizontal: 0 },
  pillText: { fontSize: 12, fontWeight: "600", maxWidth: 160 },
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: "rgba(0,0,0,0.45)" },
  card: { width: "100%", maxWidth: 400, maxHeight: "80%", borderRadius: radii.lg, borderWidth: 1, padding: 16 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  flex1: { flex: 1 },
  title: { fontSize: 17, fontWeight: "700", marginBottom: 8 },
  hint: { fontSize: 13, marginTop: 2, marginBottom: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: 12, height: 42, marginBottom: 8 },
  input: { flex: 1, fontSize: 14, outlineStyle: "none" },
  list: { flexGrow: 0 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 12, borderRadius: radii.sm },
  rowText: { fontSize: 15 },
  rowTextOn: { fontWeight: "700", color: shellColors.primary },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 8, paddingTop: 12, borderTopWidth: 1 },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  empty: { textAlign: "center", paddingVertical: 20, fontSize: 14 },
});