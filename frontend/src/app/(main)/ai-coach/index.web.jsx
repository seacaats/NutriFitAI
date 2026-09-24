import ConversationHistoryDrawer from "@/features/coach/components/conversationHistoryDrawer";
import { useCoachChat } from "@/features/coach/hooks/useCoachChat";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenPalette, getScreenTones, screenTones, shellColors } from "@/shared/theme/nutrifit";
import { aiCoachStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View
} from "react-native";

/** "3:42 PM" for a message's createdAt, in the viewer's own local time. */
function formatMessageTime(createdAt) {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Fills the whole dashboard content pane instead of sitting in a bordered,
 * width-capped "card" floating in the middle of it -- that boxed look was
 * the awkwardness being fixed. DashboardLayout's scrollable={false} is what
 * makes this possible: without it, the layout's own outer ScrollView would
 * fight this screen's inner message-list ScrollView, and the input bar could
 * never truly pin to the bottom of the content area the way it does here
 * (and the way it already does on the native/mobile screen).
 */
export default function AICoachScreen() {
  const { darkMode } = useTheme();
  const scrollRef = useRef(null);

  const [message, setMessage] = useState("");
  const {
    messages, sending, error, send, retry, reset,
    conversations, historyLoading, conversationId, loadConversation,
  } = useCoachChat();

  const { card, textColor } = getScreenPalette(darkMode);
  const historyTheme = {
    text: darkMode ? colors.white : screenTones.light.text,
    subtext: colors.textMuted,
    bg: getScreenTones(darkMode).card,
    border: card.borderColor,
    activeBg: darkMode ? "#2d3a22" : shellColors.light.activeNavBg,
  };

  const sendMessage = () => {
    const text = message.trim();
    if (!text || sending) return;
    send(text);
    setMessage("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <DashboardLayout scrollable={false}>
      <KeyboardAvoidingView
        style={[styles.flex1, card]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        <View style={[styles.chatHeader, { borderBottomColor: card.borderColor }]}>
          <View style={styles.botIcon}>
            <Ionicons name="hardware-chip" size={20} color={shellColors.primary} />
          </View>

          <View style={styles.flex1}>
            <Text style={[styles.chatTitle, textColor]}>NutriFit AI</Text>
            <Text style={styles.chatSubtitle}>Your personal nutrition coach</Text>
          </View>

          <ConversationHistoryDrawer
            conversations={conversations}
            currentId={conversationId}
            loading={historyLoading}
            onSelect={loadConversation}
            onNewChat={reset}
            theme={historyTheme}
          />
        </View>

        {/* Messages -- the readable column is capped and centered, but the
            pane itself (background, header, input bar) spans the full
            content width behind it. */}
        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          <View style={styles.messagesColumn}>
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const aiBubble = { backgroundColor: getScreenTones(darkMode).surfaceMuted };

              // Pending assistant turn: a spinner in place of an empty bubble,
              // so a slow local model reads as "thinking", not "broken".
              if (msg.pending) {
                return (
                  <View key={msg.id} style={[styles.messageRow, styles.messageRowLeft]}>
                    <View style={[styles.bubble, aiBubble, styles.bubblePending]}>
                      <ActivityIndicator size="small" color={shellColors.primary} />
                      <Text style={[styles.bubbleTextAi, { color: darkMode ? "#e5e7eb" : "#374151" }]}>
                        Thinking...
                      </Text>
                    </View>
                  </View>
                );
              }

              const timeLabel = formatMessageTime(msg.createdAt);

              return (
                <View
                  key={msg.id}
                  style={[styles.messageRow, isUser ? styles.messageRowRight : styles.messageRowLeft]}
                >
                  <View style={isUser ? styles.messageStackRight : styles.messageStackLeft}>
                    <View style={[styles.bubble, isUser ? styles.bubbleUser : aiBubble]}>
                      <Text style={isUser ? styles.bubbleTextUser : [styles.bubbleTextAi, { color: darkMode ? "#e5e7eb" : "#374151" }]}>
                        {msg.content}
                      </Text>
                    </View>
                    {Boolean(timeLabel) && <Text style={styles.timeText}>{timeLabel}</Text>}
                  </View>
                </View>
              );
            })}

            {Boolean(error) && (
              <View style={[styles.messageRow, styles.messageRowLeft]}>
                <Pressable onPress={retry} style={styles.errorBubble}>
                  <Ionicons name="refresh" size={14} color={colors.dangerStrong} />
                  <Text style={styles.errorText}>{error} Click to retry.</Text>
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Input -- pinned to the bottom of the content pane, same as the
            native screen, because this whole column is no longer wrapped in
            an outer ScrollView that could push it out of view. */}
        <View style={[styles.inputBar, { borderTopColor: card.borderColor }]}>
          <View style={styles.inputColumn}>
            <View style={[styles.inputPill, { borderColor: darkMode ? "#4b5563" : colors.border }]}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                onSubmitEditing={sendMessage}
                placeholder="Type your message..."
                placeholderTextColor={screenTones.dark.muted}
                style={[styles.textInput, textColor]}
                returnKeyType="send"
                editable={!sending}
              />

              <Pressable
                onPress={sendMessage}
                disabled={sending || !message.trim()}
                style={[styles.sendBtn, (sending || !message.trim()) && styles.sendBtnDisabled]}
              >
                <Ionicons name="send" size={14} color={colors.white} />
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  ...aiCoachStyles,

  // Header
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  botIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: shellColors.light.activeNavBg,
    alignItems: "center",
    justifyContent: "center",
  },
  chatTitle: { fontSize: 14, fontWeight: "700" },
  chatSubtitle: { fontSize: 10, color: colors.textMuted, marginTop: 2 },

  // Messages -- the pane fills the content area; only this inner column caps
  // reading width, so bubbles don't stretch edge-to-edge on a wide monitor.
  messagesContent: { paddingVertical: 20, paddingHorizontal: 24, flexGrow: 1 },
  messagesColumn: { width: "100%", maxWidth: 900, alignSelf: "center", gap: 16 },
  messageRow: { flexDirection: "row" },
  messageRowLeft: { justifyContent: "flex-start" },
  messageRowRight: { justifyContent: "flex-end" },
  messageStackLeft: { maxWidth: "70%", alignItems: "flex-start" },
  messageStackRight: { maxWidth: "70%", alignItems: "flex-end" },

  bubble: { maxWidth: "100%", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  timeText: { fontSize: 10, color: colors.textMuted, marginTop: 4 },

  sendBtnDisabled: { opacity: 0.45 },

  // Input
  inputBar: { borderTopWidth: 1, paddingVertical: 16, paddingHorizontal: 24 },
  inputColumn: { width: "100%", maxWidth: 900, alignSelf: "center" },
  textInput: { flex: 1, fontSize: 14, paddingVertical: 6, outlineStyle: "none" },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: shellColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});