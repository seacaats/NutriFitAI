import { formatMessageTime } from "@/features/coach/hooks/useCoachChat";
import Skeleton from "@/shared/components/Skeleton";
import { colors, getScreenTones, shellColors } from "@/shared/theme/nutrifitai";
import { aiCoachStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

/**
 * The thread itself, shared by the native and web coach screens: the
 * loading placeholder, the bubbles, the "Thinking..." turn and the retry
 * row. Each screen keeps its own frame around it (header, scroll view,
 * input bar). `wide` is the web look: narrower bubbles in a wide column
 * and "Click" instead of "Tap"
 */
export default function ChatMessages({ messages, loadingThread, error, onRetry, darkMode, wide = false }) {
  const tone = getScreenTones(darkMode);
  const aiBubble = { backgroundColor: tone.surfaceMuted };
  const aiText = { color: tone.text };

  if (loadingThread) return <MessagesSkeleton darkMode={darkMode} />;

  return (
    <>
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const side = isUser ? styles.right : styles.left;

        // A pending assistant turn renders as a spinner in the bubble rather
        // than an empty box, so a slow local model reads as "thinking"
        if (msg.pending) {
          return (
            <View key={msg.id} style={[styles.left, wide && styles.stackWide, wide && styles.selfStart]}>
              <View style={[styles.bubble, wide && styles.bubbleWide, aiBubble, styles.bubblePending]}>
                <ActivityIndicator size="small" color={shellColors.primary} />
                <Text style={[styles.bubbleTextAi, aiText]}>Thinking...</Text>
              </View>
            </View>
          );
        }

        const timeLabel = formatMessageTime(msg.createdAt);
        return (
          <View key={msg.id} style={[side, wide && styles.stackWide, wide && (isUser ? styles.selfEnd : styles.selfStart)]}>
            <View style={[styles.bubble, wide && styles.bubbleWide, isUser ? styles.bubbleUser : aiBubble]}>
              <Text style={isUser ? styles.bubbleTextUser : [styles.bubbleTextAi, aiText]}>{msg.content}</Text>
            </View>
            {!!timeLabel && <Text style={styles.timeText}>{timeLabel}</Text>}
          </View>
        );
      })}

      {!!error && (
        <View style={styles.left}>
          <Pressable onPress={onRetry} style={styles.errorBubble}>
            <Ionicons name="refresh" size={14} color={colors.dangerStrong} />
            <Text style={styles.errorText}>{error} {wide ? "Click" : "Tap"} to retry.</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

// Placeholder exchange while a conversation loads, on open or when one is
// picked from the history list: one user bubble, one coach reply. Tinted
// like the real bubbles, the default skeleton gray barely shows on the
// white light-mode pane
const SKELETON_BUBBLES = [
  { right: true, width: "55%", height: 40 },
  { right: false, width: "75%", height: 64 },
];

function MessagesSkeleton({ darkMode }) {
  const tone = getScreenTones(darkMode);
  return (
    <View style={styles.skeletonList}>
      {SKELETON_BUBBLES.map((b, i) => (
        <View key={i} style={b.right ? styles.right : styles.left}>
          <Skeleton
            width={b.width}
            height={b.height}
            borderRadius={14}
            style={{ backgroundColor: b.right ? shellColors.primary : tone.border }}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ...aiCoachStyles,

  left: { alignItems: "flex-start" },
  right: { alignItems: "flex-end" },
  // Web: the whole stack (bubble + time) capped, the bubble fills it
  stackWide: { maxWidth: "70%" },
  selfStart: { alignSelf: "flex-start" },
  selfEnd: { alignSelf: "flex-end" },

  bubble: { maxWidth: "80%", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleWide: { maxWidth: "100%", paddingHorizontal: 16, paddingVertical: 12 },
  timeText: { fontSize: 10, color: colors.textMuted, marginTop: 4 },

  skeletonList: { gap: 16 },
});