import { getScreenTones, shellColors, colors as themeColors } from "@/shared/theme/nutrifit";
import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const QUICK_PROMPTS = ["Is this balanced?", "How can I improve it?", "Is it high in protein?"];

function createReply(question, food, nutrition) {
  const query = question.toLowerCase();

  if (query.includes("protein")) {
    return `${food.name} has ${nutrition.protein} of protein in this estimated ${food.grams} serving. That is a protein-rich meal for most people.`;
  }
  if (query.includes("calorie") || query.includes("kcal")) {
    return `The scan estimates ${nutrition.kcal} kcal. Image-based portions can be inaccurate, so confirm the serving size before adding it to your meal log.`;
  }
  if (query.includes("improve") || query.includes("health") || query.includes("better")) {
    return `Add a side of vegetables or fruit for more fiber and micronutrients. If you want fewer calories, choose a smaller portion and keep sauces or cheese moderate.`;
  }
  if (query.includes("balanced") || query.includes("macro")) {
    return `This meal provides ${nutrition.protein} protein, ${nutrition.carbs} carbs, and ${nutrition.fat} fat. It has all three macros, but adding vegetables would make it more balanced.`;
  }
  if (query.includes("portion") || query.includes("gram")) {
    return `The detected portion is about ${food.grams}. Adjusting the portion will change every nutrition estimate proportionally.`;
  }

  return `Based on the scan, ${food.name} is estimated at ${nutrition.kcal} kcal with ${nutrition.protein} protein, ${nutrition.carbs} carbs, and ${nutrition.fat} fat. Ask me about balance, protein, calories, or portion size.`;
}

export default function FoodAnalysisChat({ food, nutrition, darkMode = false }) {
  const scrollRef = useRef(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      type: "ai",
      text: `I analyzed your ${food.name}. This ${food.grams} serving is estimated at ${nutrition.kcal} kcal. Ask me anything about the result.`,
    },
  ]);

  // card/border/text match the tones every dashboard screen shares (see
  // shared/theme/nutrifit.js); muted/aiBubble/prompt are this component's
  // own slightly different tints, kept local rather than forced to match
  const tones = getScreenTones(darkMode);
  const colors = {
    card: tones.card,
    border: tones.border,
    text: tones.text,
    muted: darkMode ? "#aab2bf" : tones.muted,
    aiBubble: darkMode ? "#30352e" : "#f1f7ee",
    prompt: darkMode ? "#293328" : "#f4faF1",
  };

  const sendMessage = (preset) => {
    const question = (preset || message).trim();
    if (!question) return;

    setMessages((current) => [
      ...current,
      { type: "user", text: question },
      { type: "ai", text: createReply(question, food, nutrition) },
    ]);
    setMessage("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.botIcon}><Ionicons name="sparkles" size={18} color={shellColors.primary} /></View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Ask Nori about this meal</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Frontend nutrition analysis</Text>
        </View>
        <View style={styles.resultBadge}><View style={styles.resultDot} /><Text style={styles.resultBadgeText}>Result ready</Text></View>
      </View>

      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent}>
        {messages.map((item, index) => (
          <View key={`${item.type}-${index}`} style={[styles.messageRow, item.type === "user" && styles.messageRowUser]}>
            <View style={[styles.bubble, item.type === "user" ? styles.userBubble : { backgroundColor: colors.aiBubble }]}>
              <Text style={[styles.bubbleText, { color: item.type === "user" ? themeColors.white : colors.text }]}>{item.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.prompts}>
        {QUICK_PROMPTS.map((prompt) => (
          <Pressable key={prompt} onPress={() => sendMessage(prompt)} style={[styles.prompt, { backgroundColor: colors.prompt, borderColor: colors.border }]}>
            <Text style={styles.promptText}>{prompt}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.inputRow, { borderColor: colors.border }]}>
        <TextInput
          value={message}
          onChangeText={setMessage}
          onSubmitEditing={() => sendMessage()}
          placeholder="Ask about this scan..."
          placeholderTextColor="#9ca3af"
          returnKeyType="send"
          style={[styles.input, { color: colors.text }]}
        />
        <Pressable onPress={() => sendMessage()} style={styles.sendButton}>
          <Ionicons name="send" size={15} color={themeColors.white} />
        </Pressable>
      </View>
      <Text style={[styles.disclaimer, { color: colors.muted }]}>Estimates are for general guidance and are not medical advice.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  header: { minHeight: 65, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  botIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#dcffcc" },
  headerCopy: { flex: 1 }, title: { fontSize: 14, fontWeight: "800" }, subtitle: { marginTop: 2, fontSize: 10 },
  resultBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 14, backgroundColor: "#edf9e8", paddingHorizontal: 8, paddingVertical: 5 },
  resultDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: shellColors.primary }, resultBadgeText: { color: "#347a22", fontSize: 9, fontWeight: "700" },
  messages: { height: 190 }, messagesContent: { padding: 14, gap: 10 }, messageRow: { alignItems: "flex-start" }, messageRowUser: { alignItems: "flex-end" },
  bubble: { maxWidth: "86%", borderRadius: 13, paddingHorizontal: 13, paddingVertical: 10 }, userBubble: { backgroundColor: shellColors.primary }, bubbleText: { fontSize: 12, lineHeight: 18 },
  prompts: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 14, paddingBottom: 10 },
  prompt: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 }, promptText: { color: shellColors.primary, fontSize: 10, fontWeight: "700" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 22, marginHorizontal: 14, paddingLeft: 14, paddingRight: 5, paddingVertical: 4 },
  input: { flex: 1, minHeight: 32, fontSize: 12 }, sendButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: shellColors.primary },
  disclaimer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, fontSize: 8, textAlign: "center" },
});