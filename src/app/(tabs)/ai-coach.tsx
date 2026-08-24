import { ChatMessage } from "@/data/placeholders";
import { useAICoach } from "@/hooks/use-ai-coach";
import { colors, radii, spacing, typography } from "@/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender === "user";

  if (message.items) {
    return (
      <View style={styles.bubbleRow}>
        <View style={styles.avatar}>
          <Ionicons name="hardware-chip-outline" size={16} color="#7B4FE0" />
        </View>
        <View style={[styles.bubble, styles.botBubble]}>
          {message.items.map((item) => (
            <View key={item} style={styles.checklistRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              <Text style={styles.checklistText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Ionicons name="hardware-chip-outline" size={16} color="#7B4FE0" />
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.botBubble]}>
        <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>{message.text}</Text>
      </View>
    </View>
  );
}

export default function AICoachScreen() {
  const router = useRouter();
  const coach = useAICoach();

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Ionicons name="hardware-chip-outline" size={16} color="#7B4FE0" />
          </View>
          <Text style={styles.headerTitle}>Nori AI</Text>
        </View>
        <Ionicons name="ellipsis-vertical" size={20} color={colors.textPrimary} />
      </View>

      <FlatList
        data={coach.messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.messageWrap}>
            <Bubble message={item} />
            <Text style={[styles.time, item.sender === "user" && styles.timeUser]}>{item.time}</Text>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={coach.input}
          onChangeText={coach.setInput}
          onSubmitEditing={coach.sendMessage}
        />
        <Pressable onPress={coach.sendMessage} hitSlop={10}>
          <Ionicons name="send" size={22} color={colors.primary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bgWhite },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingTop: 54, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.cardBorder },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F3D9FA", alignItems: "center", justifyContent: "center" },
  headerTitle: { ...typography.h3 },
  list: { padding: spacing.lg, paddingBottom: spacing.xl },
  messageWrap: { marginBottom: spacing.md },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleRowUser: { justifyContent: "flex-end" },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#F3D9FA", alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "75%", borderRadius: radii.lg, padding: 12 },
  botBubble: { backgroundColor: "#F0F0F0", borderTopLeftRadius: 4 },
  userBubble: { backgroundColor: colors.primary, borderTopRightRadius: 4 },
  bubbleText: { color: colors.textPrimary, fontSize: 15, lineHeight: 20 },
  userBubbleText: { color: colors.white },
  checklistRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  checklistText: { color: colors.textPrimary, fontSize: 15 },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 4, marginLeft: 34 },
  timeUser: { textAlign: "right", marginRight: 4, marginLeft: 0 },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.cardBorder },
  input: { flex: 1, height: 46, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.cardBorder, paddingHorizontal: 16, fontSize: 15 },
});
