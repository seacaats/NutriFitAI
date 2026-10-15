import ChatMessages from "@/features/coach/components/ChatMessages";
import CoachInputBox from "@/features/coach/components/CoachInputBox";
import { CoachToneButton } from "@/features/coach/components/CoachToneOptions";
import CoachWelcome, { SubjectChip } from "@/features/coach/components/CoachWelcome";
import ConversationHistoryDrawer from "@/features/coach/components/ConversationHistoryDrawer";
import { COUNTER_FROM, MAX_MESSAGE_LENGTH, useCoach } from "@/features/coach/hooks/useCoachChat";
import DashboardLayout from "@/shared/components/layout/DashboardLayout";
import { ScreenAlert } from "@/shared/components/ui/ScreenAlert";
import { useTheme } from "@/shared/context/ThemeContext";
import { colors, getScreenPalette, getScreenTones, screenTones, shellColors } from "@/shared/theme/nutrifitai";
import { aiCoachStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

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
  const { width, height } = useWindowDimensions();
  // Same breakpoints as DashboardLayout: phones are under 720 wide, short windows under 720 tall.
  // Small screens get slimmer bars and gutters, so the messages keep the room
  const compact = width < 720;
  const tight = compact || height < 720;
  const gutter = compact ? 16 : 24;

  const {
    messages, sending, error, retry, reset,
    conversations, historyLoading, conversationId, loadConversation,
    deleteConversation, deleteAllConversations, atLimit, subject,
    scrollRef, message, setMessage, loadingThread, empty, sendMessage, voice,
  } = useCoach();

  const { card, textColor } = getScreenPalette(darkMode);
  const historyTheme = {
    text: darkMode ? colors.white : screenTones.light.text,
    subtext: colors.textMuted,
    bg: getScreenTones(darkMode).card,
    border: card.borderColor,
    activeBg: darkMode ? "#2d3a22" : shellColors.light.activeNavBg,
  };

  return (
    <DashboardLayout scrollable={false} screenAlert={false}>
      <KeyboardAvoidingView
        // Page background, like every other screen, not the sidebar's card colour
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        <View style={[styles.chatHeader, tight && styles.chatHeaderTight, { borderBottomColor: card.borderColor, paddingHorizontal: gutter }]}>
          <View style={[styles.botIcon, tight && styles.botIconTight]}>
            <Ionicons name="hardware-chip" size={20} color={shellColors.primary} />
          </View>

          <View style={styles.headerText}>
            <Text numberOfLines={1} style={[styles.chatTitle, textColor]}>Nori</Text>
            {!compact && <Text style={styles.chatSubtitle}>Your NutriFitAI coach</Text>}
          </View>

          {/* Coach tone, also in Settings */}
          <CoachToneButton color={historyTheme.text} darkMode={darkMode} />

          <ConversationHistoryDrawer
            conversations={conversations}
            currentId={conversationId}
            loading={historyLoading}
            onSelect={loadConversation}
            onNewChat={reset}
            onDelete={deleteConversation}
            onDeleteAll={deleteAllConversations}
            theme={historyTheme}
          />
        </View>

        {/* Under the header, like every screen */}
        <ScreenAlert style={{ marginHorizontal: gutter, marginTop: 8 }} />

        {/* What this thread is about, when opened from a scan or meal */}
        {!!subject && (
          <View style={[styles.subjectWrap, { paddingHorizontal: gutter }]}>
            <View style={styles.messagesColumn}>
              <SubjectChip subject={subject} darkMode={darkMode} />
            </View>
          </View>
        )}

        {/* Messages -- the readable column is capped and centered, but the
            pane itself (background, header, input bar) spans the full
            content width behind it. */}
        <ScrollView
          ref={scrollRef}
          style={styles.flex1}
          contentContainerStyle={[styles.messagesContent, { paddingHorizontal: gutter, paddingVertical: tight ? 12 : 20 }, empty && styles.grow]}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          <View style={[styles.messagesColumn, compact && styles.messagesColumnCompact, empty && styles.grow]}>
            {empty && <CoachWelcome darkMode={darkMode} atLimit={atLimit} onPick={sendMessage} subject={subject} />}
            <ChatMessages messages={messages} loadingThread={loadingThread} error={error} onRetry={retry} darkMode={darkMode} wide />
          </View>
        </ScrollView>

        {/* Input -- pinned to the bottom of the content pane, same as the
            native screen, because this whole column is no longer wrapped in
            an outer ScrollView that could push it out of view. */}
        <View style={[styles.inputBar, { paddingHorizontal: gutter, paddingBottom: tight ? 12 : 16 }]}>
          <View style={styles.inputColumn}>
            <CoachInputBox
              voice={voice} message={message} setMessage={setMessage} sendMessage={sendMessage} sending={sending} atLimit={atLimit}
              textColor={textColor} borderColor={darkMode ? "#4b5563" : colors.border}
              placeholder={atLimit ? "Delete a conversation to start a new one" : "Type your message..."} web compact={compact} maxInputHeight={Math.min(180, Math.round(height * 0.25))}
            />
            {voice.error ? <Text style={[styles.counter, styles.counterFull]}>{voice.error}</Text> : null}
            {/* Only near the limit, so it doesn't clutter normal typing */}
            {message.length >= COUNTER_FROM && (
              <Text style={[styles.counter, message.length >= MAX_MESSAGE_LENGTH && styles.counterFull]}>
                {message.length.toLocaleString()}/{MAX_MESSAGE_LENGTH.toLocaleString()}
              </Text>
            )}
            {/* Always under the input, whatever's in the chat */}
            <Text style={[styles.disclaimer, tight && styles.disclaimerTight]}>Not medical advice. For symptoms or injuries, see a professional.</Text>
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
  chatHeaderTight: { paddingVertical: 10 },
  headerText: { flex: 1, minWidth: 0 },
  botIconTight: { width: 32, height: 32, borderRadius: 16 },
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
  grow: { flexGrow: 1 },
  subjectWrap: { paddingHorizontal: 24, paddingTop: 12 },
  counter: { fontSize: 11, color: colors.textMuted, textAlign: "right", marginTop: 4 },
  counterFull: { color: colors.danger, fontWeight: "700" },
  disclaimer: { fontSize: 11, color: colors.textMuted, textAlign: "center", marginTop: 8 },
  messagesColumn: { width: "100%", maxWidth: 900, alignSelf: "center", gap: 16 },
  messagesColumnCompact: { gap: 12 },
  disclaimerTight: { marginTop: 4 },

  // Input, the box itself is in CoachInputBox
  inputBar: { paddingTop: 8, paddingBottom: 16, paddingHorizontal: 24 },
  inputColumn: { width: "100%", maxWidth: 900, alignSelf: "center" },
});