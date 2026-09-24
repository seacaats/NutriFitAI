import ConversationHistoryDrawer from "@/features/coach/components/conversationHistoryDrawer";
import { useCoachChat } from "@/features/coach/hooks/useCoachChat";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, screenTones, shellColors } from "@/shared/theme/nutrifit";
import { aiCoachStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HEADER_HEIGHT = 56;

/** "3:42 PM" for a message's createdAt, in the viewer's own local time. */
function formatMessageTime(createdAt) {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function AICoachScreen() {
  const { shell: c } = useTheme();
  const scrollRef = useRef(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [message, setMessage] = useState("");
  const {
    messages, sending, error, send, retry, reset,
    conversations, historyLoading, conversationId, loadConversation,
  } = useCoachChat();

  const card = { backgroundColor: c.cardBg, borderColor: c.dropdownBorder };
  const textColor = { color: c.sidebarText };
  const aiBubble = { backgroundColor: c.inactiveNavHoverBg };

  const sendMessage = () => {
    const text = message.trim();
    if (!text || sending) return;
    send(text);
    setMessage("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <DashboardLayout scrollable={false} hideTabBar>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 16 + HEADER_HEIGHT : 0}
      >
        {/* Top Bar */}
        <View style={[styles.topBar, { borderBottomColor: card.borderColor }]}>
          <Pressable hitSlop={8} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={c.sidebarText} />
          </Pressable>

          <View style={styles.topBarTitle}>
            <View style={[styles.botIcon, { backgroundColor: c.activeNavBg }]}>
              <Ionicons name="hardware-chip" size={16} color={shellColors.primary} />
            </View>
            <Text style={[styles.topBarText, textColor]}>Nori AI</Text>
          </View>

          <ConversationHistoryDrawer
            conversations={conversations}
            currentId={conversationId}
            loading={historyLoading}
            onSelect={loadConversation}
            onNewChat={reset}
            theme={{
              text: c.sidebarText,
              subtext: colors.textMuted,
              bg: c.cardBg,
              border: c.dropdownBorder,
              activeBg: c.activeNavBg,
            }}
          />
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg) => {
            const isUser = msg.role === "user";

            // A pending assistant turn renders as a spinner in the bubble
            // rather than an empty box, so a slow local model reads as
            // "thinking" instead of "broken".
            if (msg.pending) {
              return (
                <View key={msg.id} style={styles.messageRowLeft}>
                  <View style={[styles.bubble, aiBubble, styles.bubblePending]}>
                    <ActivityIndicator size="small" color={shellColors.primary} />
                    <Text style={[styles.bubbleTextAi, textColor]}>Thinking...</Text>
                  </View>
                </View>
              );
            }

            const timeLabel = formatMessageTime(msg.createdAt);

            return (
              <View key={msg.id} style={isUser ? styles.messageRowRight : styles.messageRowLeft}>
                <View style={[styles.bubble, isUser ? styles.bubbleUser : aiBubble]}>
                  <Text style={isUser ? styles.bubbleTextUser : [styles.bubbleTextAi, textColor]}>
                    {msg.content}
                  </Text>
                </View>
                {Boolean(timeLabel) && (
                  <View style={isUser ? styles.timeRowRight : styles.timeRowLeft}>
                    <Text style={styles.timeText}>{timeLabel}</Text>
                  </View>
                )}
              </View>
            );
          })}

          {Boolean(error) && (
            <View style={styles.messageRowLeft}>
              <Pressable onPress={retry} style={styles.errorBubble}>
                <Ionicons name="refresh" size={14} color={colors.dangerStrong} />
                <Text style={styles.errorText}>{error} Tap to retry.</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Message Input */}
        <View style={[styles.inputBar, { borderTopColor: card.borderColor, paddingBottom: 12 + insets.bottom }]}>
          <View style={[styles.inputPill, { borderColor: c.dropdownBorder }]}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              onSubmitEditing={sendMessage}
              placeholder="Type a message..."
              placeholderTextColor={screenTones.dark.muted}
              style={[styles.textInput, textColor]}
              returnKeyType="send"
              editable={!sending}
            />

            <Pressable onPress={sendMessage} hitSlop={8} disabled={sending || !message.trim()}>
              <Ionicons name="send" size={18} color={sending || !message.trim() ? screenTones.dark.muted : shellColors.primary} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  ...aiCoachStyles,

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  topBarTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  botIcon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  topBarText: { fontSize: 16, fontWeight: "700" },

  // Messages
  messagesContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 16 },
  messageRowLeft: { alignItems: "flex-start" },
  messageRowRight: { alignItems: "flex-end" },

  bubble: { maxWidth: "80%", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },

  timeText: { fontSize: 10, color: screenTones.dark.muted },
  timeLeft: { fontSize: 10, color: screenTones.dark.muted, marginTop: 4 },
  timeRowLeft: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  timeRowRight: { flexDirection: "row", alignItems: "center", marginTop: 4 },

  checklistRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 3 },
  checklistText: { fontSize: 13, fontWeight: "500" },

  // Input
  inputBar: { borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 16 },
  textInput: { flex: 1, fontSize: 14, paddingVertical: 6 },
});