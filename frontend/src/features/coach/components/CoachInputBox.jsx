import VoiceLanguagePicker from "@/features/coach/components/VoiceLanguagePicker";
import VoiceRecordingBar from "@/features/coach/components/VoiceRecordingBar";
import { MAX_MESSAGE_LENGTH } from "@/features/coach/hooks/useCoachChat";
import { useFocusRing } from "@/shared/components/ui/FormInput";
import { colors, screenTones, shellColors } from "@/shared/theme/nutrifitai";
import { aiCoachStyles } from "@/shared/theme/screenStyles";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, TextInput, View } from "react-native";

// Two 36 px icons and a 4 px gap to the input box
const ICON = 36;
const TOOLS_WIDTH = ICON * 2 + 4;

// The language and mic icons beside the input box. They slide away (and the box
// grows into the room) while `hidden`, e.g. when the user is typing
function VoiceTools({ voice, hidden, disabled }) {
  const anim = useRef(new Animated.Value(hidden ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: hidden ? 0 : 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      // Width can't run on the native driver
      useNativeDriver: false,
    }).start();
  }, [hidden, anim]);

  if (!voice.supported) return null;

  return (
    <Animated.View
      // Hidden icons can't be tapped or read out while they are folded away
      pointerEvents={hidden ? "none" : "auto"}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
      style={[
        styles.slot,
        {
          opacity: anim,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: [0, TOOLS_WIDTH] }),
        },
      ]}
    >
      <Animated.View style={[styles.tools, { transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
        <VoiceLanguagePicker voice={voice} inline />

        {/* Dictate instead of typing; tap again to stop */}
        <Pressable
          onPress={voice.toggle}
          hitSlop={8}
          disabled={disabled || voice.transcribing}
          accessibilityLabel={voice.listening ? "Stop voice input" : "Voice input"}
          style={styles.micBtn}
        >
          <Ionicons name={voice.transcribing ? "hourglass-outline" : voice.listening ? "stop-circle" : "mic-outline"} size={22} color={voice.listening ? colors.danger : shellColors.primary} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * The message box of the AI coach, shared by the native and web screens: the
 * text field with its clear and send buttons, the recording bar that replaces
 * it, and the language and mic icons beside it (VoiceTools, below). The screens keep the bar
 * around it (padding, counter, disclaimer).
 *
 * web: Enter sends (Shift+Enter adds a line) and the send button is a filled circle;
 *      native: Return adds a line and the send button is a plain icon
 * compact: bigger tap targets on touch-sized screens
 * maxInputHeight: how tall the field grows before it scrolls
 */
export default function CoachInputBox({
  voice, message, setMessage, sendMessage, sending, atLimit,
  textColor, borderColor, placeholder, web = false, compact = false, maxInputHeight = 140,
}) {
  const ring = useFocusRing();
  const inputRef = useRef(null);
  // Once there is text, the field takes the whole row and the language and mic icons step aside
  const typing = message.length > 0;
  const sendOff = sending || atLimit || !message.trim();

  return (
    <View style={styles.inputRow}>
      <View style={[aiCoachStyles.inputPill, styles.inputBox, { borderColor }, ring.style]}>
        {/* While recording, the bar replaces the text box */}
        {voice.listening || voice.transcribing ? (
          <VoiceRecordingBar voice={voice} textStyle={textColor} />
        ) : (
          <>
            <TextInput
              {...ring.handlers}
              ref={inputRef}
              value={message}
              onChangeText={setMessage}
              placeholder={placeholder}
              placeholderTextColor={screenTones.dark.muted}
              style={[ring.input, styles.textInput, { maxHeight: maxInputHeight }, textColor]}
              // Grows with the message
              multiline
              textAlignVertical={web ? undefined : "top"}
              // Web: Enter sends, Shift+Enter adds a line. Native: Return adds a line, the arrow sends
              onKeyPress={web ? (e) => {
                if (e.nativeEvent.key === "Enter" && !e.nativeEvent.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              } : undefined}
              maxLength={MAX_MESSAGE_LENGTH}
              editable={!sending && !atLimit}
            />

            {/* Clears the whole message and puts the cursor back, like a search box's x */}
            {typing && !sending && (
              <Pressable
                onPress={() => { voice.cancel(); setMessage(""); inputRef.current?.focus(); }}
                hitSlop={web ? undefined : 8}
                accessibilityLabel="Clear message"
                style={web ? [styles.clearBtn, compact && styles.touchBtn] : undefined}
              >
                <Ionicons name="close-circle" size={web ? 18 : 20} color={colors.textMuted} />
              </Pressable>
            )}

            {web ? (
              <Pressable
                onPress={sendMessage}
                disabled={sendOff}
                style={[styles.sendBtn, compact && styles.touchBtn, (sending || !message.trim()) && styles.sendBtnDisabled]}
              >
                <Ionicons name="send" size={14} color={colors.white} />
              </Pressable>
            ) : (
              <Pressable onPress={sendMessage} hitSlop={8} disabled={sendOff}>
                <Ionicons name="send" size={18} color={sending || !message.trim() ? screenTones.dark.muted : shellColors.primary} />
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* Language and mic sit outside the box, sliding away while recording or typing */}
      <VoiceTools voice={voice} hidden={voice.listening || voice.transcribing || typing} disabled={sending || atLimit} />
    </View>
  );
}

const styles = StyleSheet.create({
  inputRow: { flexDirection: "row", alignItems: "flex-end" },
  // A rounded box rather than a pill, since it grows over several lines
  inputBox: { flex: 1, alignItems: "flex-end", borderRadius: 16, paddingVertical: 6 },
  textInput: { flex: 1, fontSize: 14, paddingVertical: 6, minHeight: 36 },
  clearBtn: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  // Bigger tap targets on touch-sized screens
  touchBtn: { width: 36, height: 36, borderRadius: 18 },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: shellColors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.45 },

  // Language and mic. The slot clips the icons as it narrows; the row inside keeps its own width
  slot: { alignSelf: "flex-end", height: 50, overflow: "hidden" },
  tools: { flexDirection: "row", alignItems: "center", width: TOOLS_WIDTH, height: 50, paddingLeft: 4 },
  micBtn: { width: ICON, height: 50, alignItems: "center", justifyContent: "center" },
});