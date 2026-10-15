import ChatMessages from "@/features/coach/components/ChatMessages";
import CoachInputBox from "@/features/coach/components/CoachInputBox";
import { CoachToneButton } from "@/features/coach/components/CoachToneOptions";
import CoachWelcome, { SubjectChip } from "@/features/coach/components/CoachWelcome";
import ConversationHistoryDrawer from "@/features/coach/components/ConversationHistoryDrawer";
import { COUNTER_FROM, MAX_MESSAGE_LENGTH, useCoach } from "@/features/coach/hooks/useCoachChat";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { ScreenAlert } from "@/shared/components/ui/ScreenAlert";
import { usePullRefreshState } from "@/shared/context/PullRefreshContext";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, shellColors } from "@/shared/theme/nutrifitai";
import { aiCoachStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HEADER_HEIGHT = 56;

export default function AICoachScreen() {
  const { shell: c, darkMode } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    messages, sending, error, retry, reset,
    conversations, historyLoading, conversationId, loadConversation,
    deleteConversation, deleteAllConversations, atLimit, subject,
    scrollRef, message, setMessage, loadingThread, empty, sendMessage, voice,
  } = useCoach();
  // The chat has its own scroller, so it carries the pull-to-refresh
  const pull = usePullRefreshState();

  const card = { backgroundColor: c.cardBg, borderColor: c.dropdownBorder };
  const textColor = { color: c.sidebarText };

  return (
    <DashboardLayout scrollable={false} hideTabBar screenAlert={false}>
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
            <View>
              <Text style={[styles.topBarText, textColor]}>Nori</Text>
              <Text style={styles.topBarSub}>Your NutriFitAI coach</Text>
            </View>
          </View>

          {/* Coach tone, also in Settings */}
          <CoachToneButton color={c.sidebarText} darkMode={darkMode} />

          <ConversationHistoryDrawer
            conversations={conversations}
            currentId={conversationId}
            loading={historyLoading}
            onSelect={loadConversation}
            onNewChat={reset}
            onDelete={deleteConversation}
            onDeleteAll={deleteAllConversations}
            theme={{
              text: c.sidebarText,
              subtext: colors.textMuted,
              bg: c.cardBg,
              border: c.dropdownBorder,
              activeBg: c.activeNavBg,
            }}
          />
        </View>

        {/* Under the header, like every screen */}
        <ScreenAlert style={{ marginHorizontal: 12, marginTop: 8 }} />

        {/* What this thread is about, when opened from a scan or meal */}
        {!!subject && (
          <View style={styles.subjectWrap}>
            <SubjectChip subject={subject} darkMode={darkMode} />
          </View>
        )}

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          contentContainerStyle={[styles.messagesContent, empty && styles.grow]}
          refreshControl={pull ? <RefreshControl refreshing={pull.refreshing} onRefresh={pull.refresh} tintColor={c.primary} colors={[c.primary]} /> : undefined}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {empty && <CoachWelcome darkMode={darkMode} atLimit={atLimit} onPick={sendMessage} subject={subject} />}
          <ChatMessages messages={messages} loadingThread={loadingThread} error={error} onRetry={retry} darkMode={darkMode} />
        </ScrollView>

        {/* Message Input */}
        <View style={[styles.inputBar, { paddingBottom: 12 + insets.bottom }]}>
          <CoachInputBox
            voice={voice} message={message} setMessage={setMessage} sendMessage={sendMessage} sending={sending} atLimit={atLimit}
            textColor={textColor} borderColor={c.dropdownBorder}
            placeholder={atLimit ? "Delete a conversation to start a new one" : "Type a message..."}
          />
          {voice.error ? <Text style={[styles.counter, styles.counterFull]}>{voice.error}</Text> : null}
          {/* Only near the limit, so it doesn't clutter normal typing */}
          {message.length >= COUNTER_FROM && (
            <Text style={[styles.counter, message.length >= MAX_MESSAGE_LENGTH && styles.counterFull]}>
              {message.length.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}
            </Text>
          )}
          {/* Always under the input, whatever's in the chat */}
          <Text style={styles.disclaimer}>Not medical advice. For symptoms or injuries, see a professional.</Text>
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
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  topBarTitle: {flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  botIcon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  topBarText: { fontSize: 16, fontWeight: "700"},
  topBarSub: { fontSize: 11, color: colors.textMuted },
  grow: { flexGrow: 1 },
  subjectWrap: { paddingHorizontal: 16, paddingBottom: 4 },
  counter: { fontSize: 11, color: colors.textMuted, textAlign: "right", marginTop: 4 },
  counterFull: { color: colors.danger, fontWeight: "700" },
  disclaimer: { fontSize: 10, color: colors.textMuted, textAlign: "center", marginTop: 6 },

  // Messages, the bubbles themselves are in ChatMessages
  messagesContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 16 },

  // Input
  inputBar: { paddingTop: 8, paddingHorizontal: 16 },
});