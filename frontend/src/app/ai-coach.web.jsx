import DashboardLayout from "@components/nutrifit/DashboardLayout";
import { useTheme } from "@context/ThemeContext";
import { radii } from "@theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView,
        StyleSheet, Text, TextInput, View } from "react-native";

const INITIAL_MESSAGES = [
  { type: "ai", text: "Hi John! 👋 How can I help you today?" },
  { type: "user", text: "What should I eat after my workout?" },
  { type: "ai", text: "A meal with protein and carbohydrates would be a great choice after your workout." },
  { type: "checklist", items: ["Grilled chicken", "Brown rice", "Vegetables", "Water"] },
];

export default function AICoachScreen() {
  const { darkMode } = useTheme();
  const scrollRef = useRef(null);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);

  const card = {
    backgroundColor: darkMode ? "#222222" : "#ffffff",
    borderColor: darkMode ? "#364153" : "#e5e7eb", // border-gray-200 dark:border-gray-700
  };
  const textColor = { color: darkMode ? "#ffffff" : "#111111" };

  const sendMessage = () => {
    if (!message.trim()) return;

    setMessages((current) => [
      ...current,
      { type: "user", text: message },
      { type: "ai", text: "That's a great question! I'll help you make a healthy choice based on your goals." },
    ]);

    setMessage("");

    // message tick
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <DashboardLayout>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={[styles.chatCard, card]}>
          {/* Header */}
          <View style={[styles.chatHeader, { borderBottomColor: card.borderColor }]}>
            <View style={styles.botIcon}>
              <Ionicons name="hardware-chip" size={20} color="#4CAF2F" />
            </View>

            <View>
              <Text style={[styles.chatTitle, textColor]}>NutriFit AI</Text>
              <Text style={styles.chatSubtitle}>Your personal nutrition coach</Text>
            </View>
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
                  <View key={index} style={[styles.messageRow, styles.messageRowLeft]}>
                    <View style={[styles.bubble, styles.checklistBubble, { backgroundColor: darkMode ? "#333333" : "#f3f4f6" }]}>
                      {msg.items.map((item) => (
                        <View key={item} style={styles.checklistRow}>
                          <Ionicons name="checkmark-circle" size={14} color="#4CAF2F" />
                          <Text style={[styles.checklistText, textColor]}>{item}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              }

              return (
                <View
                  key={index}
                  style={[styles.messageRow, msg.type === "user" ? styles.messageRowRight : styles.messageRowLeft]}
                >
                  <View
                    style={[
                      styles.bubble,
                      msg.type === "user"
                        ? styles.bubbleUser
                        : { backgroundColor: darkMode ? "#333333" : "#f3f4f6" },
                    ]}
                  >
                    <Text style={msg.type === "user" ? styles.bubbleTextUser : [styles.bubbleTextAi, { color: darkMode ? "#e5e7eb" : "#374151" }]}>
                      {msg.text}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Input */}
          <View style={[styles.inputBar, { borderTopColor: card.borderColor }]}>
            <View style={[styles.inputPill, { borderColor: darkMode ? "#4b5563" : "#d1d5dc" }]}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                onSubmitEditing={sendMessage}
                placeholder="Type your message..."
                placeholderTextColor="#9ca3af"
                style={[styles.textInput, textColor]}
                returnKeyType="send"
              />

              <Pressable onPress={sendMessage} style={styles.sendBtn}>
                <Ionicons name="send" size={14} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </DashboardLayout>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },

  chatCard: {
    flex: 1,
    maxWidth: 896, // max-w-4xl
    alignSelf: "center",
    width: "100%",
    borderRadius: radii.sm,
    borderWidth: 1,
  },

  // Header
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderBottomWidth: 1 },
  botIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#dcffcc",
    alignItems: "center",
    justifyContent: "center",
  },
  chatTitle: { fontSize: 14, fontWeight: "700" },
  chatSubtitle: { fontSize: 10, color: "#6a7282", marginTop: 2 },

  // Messages
  messagesContent: { padding: 20, gap: 16 },
  messageRow: { flexDirection: "row" },
  messageRowLeft: { justifyContent: "flex-start" },
  messageRowRight: { justifyContent: "flex-end" },

  bubble: { maxWidth: "70%", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  bubbleUser: { backgroundColor: "#4CAF2F" },
  bubbleTextUser: { fontSize: 14, color: "#ffffff" },
  bubbleTextAi: { fontSize: 14 },

  // Recommendation
  checklistBubble: { maxWidth: "80%" },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 3 },
  checklistText: { fontSize: 13, fontWeight: "500" },

  // Input
  inputBar: { borderTopWidth: 1, padding: 16 },
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
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#4CAF2F",
    alignItems: "center",
    justifyContent: "center",
  },
});