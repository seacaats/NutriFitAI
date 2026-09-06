import DashboardLayout from "@components/nutrifit/DashboardLayout";
import { useTheme } from "@context/ThemeContext";
import { radii } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView,
        StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const INITIAL_MESSAGES = [
  { type: "ai", text: "Hi Jose! 👋\nHow can I help you today?", time: "10:30 am" },
  { type: "user", text: "What should I eat after workout?", time: "10:30 am" },
  { type: "ai", text: "For Muscle Recovery, I recommend a balanced meal with protein and good carbs.", time: "10:31 am" },
  { type: "checklist", items: ["Grilled Chicken", "Brown Rice", "Greek Yogurt", "Banana"], time: "10:31 am" },
];

const CANNED_REPLY = "That's a great question! I'll help you make a healthy choice based on your goals.";

const HEADER_HEIGHT = 56;

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

export default function AICoachScreen() {
  const { shell: c } = useTheme();
  const scrollRef = useRef(null);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);

  const card = { backgroundColor: c.cardBg, borderColor: c.dropdownBorder };
  const textColor = { color: c.sidebarText };
  const aiBubble = { backgroundColor: c.inactiveNavHoverBg };

  const sendMessage = () => {
    if (!message.trim()) return;

    setMessages((current) => [
      ...current,
      { type: "user", text: message, time: formatTime() },
      { type: "ai", text: CANNED_REPLY, time: formatTime() },
    ]);

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
              <Ionicons name="hardware-chip" size={16} color="#4CAF2F" />
            </View>
            <Text style={[styles.topBarText, textColor]}>Nori AI</Text>
          </View>

          <Pressable hitSlop={8}>
            <Ionicons name="ellipsis-vertical" size={20} color={c.sidebarText} />
          </Pressable>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg, index) => {
            if (msg.type === "checklist") {
              return (
                <View key={index} style={styles.messageRowLeft}>
                  <View style={[styles.bubble, aiBubble]}>
                    {msg.items.map((item) => (
                      <View key={item} style={styles.checklistRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#4CAF2F" />
                        <Text style={[styles.checklistText, textColor]}>{item}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.timeLeft}>{msg.time}</Text>
                </View>
              );
            }

            const isUser = msg.type === "user";
            return (
              <View key={index} style={isUser ? styles.messageRowRight : styles.messageRowLeft}>
                <View style={[styles.bubble, isUser ? styles.bubbleUser : aiBubble]}>
                  <Text style={isUser ? styles.bubbleTextUser : [styles.bubbleTextAi, textColor]}>
                    {msg.text}
                  </Text>
                </View>

                <View style={isUser ? styles.timeRowRight : styles.timeRowLeft}>
                  {isUser && <Ionicons name="checkmark" size={12} color="#9ca3af" style={{ marginRight: 4 }} />}
                  <Text style={styles.timeText}>{msg.time}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Message Input */}
        <View style={[styles.inputBar, { borderTopColor: card.borderColor, paddingBottom: 12 + insets.bottom }]}>
          <View style={[styles.inputPill, { borderColor: c.dropdownBorder }]}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              onSubmitEditing={sendMessage}
              placeholder="Type a message..."
              placeholderTextColor="#9ca3af"
              style={[styles.textInput, textColor]}
              returnKeyType="send"
            />

            <Pressable onPress={sendMessage} hitSlop={8}>
              <Ionicons name="send" size={18} color="#4CAF2F" />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },

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
  bubbleUser: { backgroundColor: "#4CAF2F" },
  bubbleTextUser: { fontSize: 14, color: "#ffffff" },
  bubbleTextAi: { fontSize: 14 },

  timeText: { fontSize: 10, color: "#9ca3af" },
  timeLeft: { fontSize: 10, color: "#9ca3af", marginTop: 4 },
  timeRowLeft: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  timeRowRight: { flexDirection: "row", alignItems: "center", marginTop: 4 },

  checklistRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 3 },
  checklistText: { fontSize: 13, fontWeight: "500" },

  // Input
  inputBar: { borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 16 },
  inputPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  textInput: { flex: 1, fontSize: 14, paddingVertical: 6 },
});