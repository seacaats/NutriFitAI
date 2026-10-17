import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { useAuth } from "@/shared/context/AuthContext";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { forgetRemembered, getRemembered, setRemembered } from "@/shared/utils/rememberedState";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";
/**
 * Backs both AI coach screens so they share one definition of what a message
 * is, how sending works, and what happens when the provider chain is exhausted
 *
 * If the request fails, the user's message stays on screen (the server persisted it 
 * too) and an error line is shown, so nothing anyone typed is ever silently thrown away
 *
 * Also owns the recent-conversations list: the server returns the last 10
 * threads sorted newest-first (see coachController.HISTORY_LIMIT), and this
 * hook mirrors that list and lets a screen swap the active thread in
 *
 * PERSISTENCE NOTE: conversationId used to live only in this hook's React
 * state, so it reset to null on every remount (tab switch, refresh, closing
 * and reopening the app) even though the thread itself was never deleted —
 * chat_messages is an unbounded, referenced collection, not capped at any message count. 
 * The result looked like a "2-message" cap: each mount started a *new* conversation, 
 * and most mounts only see one exchange (one user + one assistant message) before the user
 * navigates away. The fix is below — the active id is remembered per account
 * (rememberedState.js) and resumed on mount, so a thread keeps growing across
 * reloads instead of forking a fresh one every time. After RESUME_MS without
 * use the coach opens on a fresh chat instead; the old one stays in history
 */

const WEB = Platform.OS === "web";

// Mirrors MAX_CONVERSATIONS in coachController.js: a user keeps at most
// this many conversations, and must delete one to start another
export const MAX_CONVERSATIONS = 10;

// Mirrors MAX_MESSAGE_LENGTH in coachValidators.js. The field stops there;
// the counter shows from COUNTER_FROM so it doesn't sit on screen all the time
export const MAX_MESSAGE_LENGTH = 2000;
export const COUNTER_FROM = 1800;

const LAST_CONVERSATION = "coach-thread";
// Resumed within a day of last use, a new chat after that
const RESUME_MS = 24 * 60 * 60 * 1000;

// Shortest time the loading placeholder stays up when an existing thread
// loads, so a fast response still shows it instead of flashing past
const MIN_THREAD_LOAD_MS = 450;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let localId = 0;
const nextId = () => `local-${++localId}`;

// Message timestamp in the device's own timezone:
//   today       "3:42 PM"
//   yesterday   "Yesterday, 3:42 PM"
//   older       "Sep 21, 3:42 PM", plus the year only when it isn't this year
export function formatMessageTime(createdAt) {
  if (!createdAt) return "";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

  if (days <= 0) return time;
  if (days === 1) return `Yesterday, ${time}`;

  const day = date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  });
  return `${day}, ${time}`;
}

/**
 * `about` is { scanId } or { mealId } when the screen was opened from the
 * food scanner's "Ask AI Coach" (/ai-coach?scan= or ?meal=), else null.
 * That always starts a fresh thread about it instead of resuming the last
 * one; the server attaches the ref on the first message and reads the scan
 * or meal itself on every turn after
 */
export function useCoachChat(about = null) {
  const userId = useAuth().user?.id;
  const aboutKey = about?.scanId ? `scan:${about.scanId}` : about?.mealId ? `meal:${about.mealId}` : "";

  // Empty until the user writes; the screen shows a welcome in its place
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Recent-history list. Server already caps at 10 and sorts newest-first
  const [conversations, setConversations] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  // True only while the very first mount is checking storage for a thread to
  // resume, so a screen can hold off rendering the greeting for a beat rather
  // than flashing it before the real history swaps in
  const [resuming, setResuming] = useState(true);
  // The scan or meal the open thread is about, for the pinned chip:
  // { kind, id, label, caloriesKcal, date, mealType? } or null
  const [subject, setSubject] = useState(null);

  // Lets an unmounting screen cancel in-flight generation rather than leaving
  // the request burning provider quota for an answer nobody will read
  const abortRef = useRef(null);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const rows = await apiClient.get("/coach/conversations", { auth: true });
      setConversations(rows);
    } catch {
      // History is a convenience list, not core chat function — fail quietly
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  /** Fetches one thread and swaps it in as the active conversation */
  const applyConversation = useCallback(async (id) => {
    const data = await apiClient.get(`/coach/conversations/${id}`, { auth: true });
    setConversationId(data.id);
    // A last user message with no reply failed earlier; the next send
    // replaces it (the server overwrites it too)
    const rows = data.messages || [];
    const last = rows[rows.length - 1];
    setMessages(last?.role === "user" ? [...rows.slice(0, -1), { ...last, failed: true }] : rows);
    setSubject(data.subject || null);
    await setRemembered(LAST_CONVERSATION, userId, data.id);
    return data;
  }, [userId]);

  // On mount: populate the history list, and resume whichever thread was last
  // active rather than always starting blank. Opened about a scan or meal,
  // it starts fresh instead and only loads the chip
  useEffect(() => {
    let cancelled = false;

    refreshHistory();

    if (aboutKey) {
      setMessages([]);
      setConversationId(null);
      (async () => {
        const [kind, id] = aboutKey.split(":");
        try {
          const data = await apiClient.get(`/coach/subject?${kind}Id=${id}`, { auth: true });
          if (cancelled) return;
          setSubject(data);
        } catch {
          // Deleted, or not this user's: fall back to an ordinary new chat
          if (!cancelled) setError("That meal is no longer available, so this is a regular chat.");
        } finally {
          if (!cancelled) setResuming(false);
        }
      })();
      return () => { cancelled = true; };
    }

    (async () => {
      const storedId = await getRemembered(LAST_CONVERSATION, userId, RESUME_MS);
      if (!storedId || cancelled) {
        if (!cancelled) setResuming(false);
        return;
      }
      try {
        await Promise.all([applyConversation(storedId), wait(MIN_THREAD_LOAD_MS)]);
      } catch {
        // Thread is gone (deleted, or aged out past the 180-day TTL) — drop
        // the stale pointer and fall back to a fresh greeting
        await forgetRemembered(LAST_CONVERSATION, userId);
      } finally {
        if (!cancelled) setResuming(false);
      }
    })();

    return () => { cancelled = true; };
  }, [aboutKey, userId]);

  const send = useCallback(async (raw) => {
    const message = String(raw || "").trim();
    if (!message || sending) return;

    setError("");
    setSending(true);

    const userMessage = { id: nextId(), role: "user", content: message, createdAt: new Date().toISOString() };
    const placeholder = { id: nextId(), role: "assistant", content: "", pending: true };
    // A message that got no reply is overwritten by the next one, not stacked
    setMessages((current) => [...current.filter((m) => !m.failed), userMessage, placeholder]);

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    abortRef.current = controller;

    try {
      // A new thread about a scan or meal carries its id; after that the
      // conversation itself remembers it
      const ref = !conversationId && subject && !subject.missing ? { [`${subject.kind}Id`]: subject.id } : {};
      const data = await apiClient.post(
        "/coach/chat",
        { message, ...(conversationId ? { conversationId } : ref) },
        { auth: true },
      );

      setConversationId(data.conversationId);
      setMessages((current) =>
        current.map((m) =>
          m.id === placeholder.id
            ? { id: data.message.id, role: "assistant", content: data.message.content, pending: false, createdAt: data.message.createdAt }
            : m,
        ),
      );
      // Keep resuming this same thread on the next mount/reload. A thread
      // opened about a scan or meal isn't, the coach reopens on the usual one
      if (!aboutKey) await setRemembered(LAST_CONVERSATION, userId, data.conversationId);
      // New/updated thread moves to the top of the list, same as the
      // server's own updatedAt-desc order
      refreshHistory();
    } catch (err) {
      // Drop the placeholder rather than leaving an empty bubble spinning. At
      // the conversation limit nothing was saved, so the message goes too
      const limited = err instanceof ApiClientError && err.code === "CONVERSATION_LIMIT";
      setMessages((current) => current
        .filter((m) => m.id !== placeholder.id && !(limited && m.id === userMessage.id))
        // Marked so the next send or retry replaces it instead of adding another
        .map((m) => (m.id === userMessage.id ? { ...m, failed: true } : m)));

      // The server saved the message to a thread even though the reply failed.
      // Adopt it, so the next send continues there instead of starting a new one
      const failedIn = err instanceof ApiClientError ? err.details?.conversationId : null;
      if (failedIn) {
        setConversationId(failedIn);
        if (!aboutKey) await setRemembered(LAST_CONVERSATION, userId, failedIn);
        refreshHistory();
      }

      setError(
        err instanceof ApiClientError && err.code === "AI_UNAVAILABLE"
          ? "The coach is unavailable right now. Please try again in a moment."
          : err?.message || "Couldn't reach the coach.",
      );
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }, [conversationId, sending, refreshHistory, subject, aboutKey, userId]);

  /** Starts a fresh thread; the old one stays in history on the server */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setSubject(null);
    setError("");
    forgetRemembered(LAST_CONVERSATION, userId);
  }, [userId]);

  /** Re-sends the last user turn after a failure, without retyping it */
  const retry = useCallback(() => {
    const failed = [...messages].reverse().find((m) => m.role === "user" && m.failed);
    if (failed) send(failed.content);
  }, [messages, send]);

  /** Swaps in a past thread picked from the history list */
  const loadConversation = useCallback(async (id) => {
    if (!id || id === conversationId || switching) return;
    abortRef.current?.abort();
    setSwitching(true);
    setError("");
    try {
      await Promise.all([applyConversation(id), wait(MIN_THREAD_LOAD_MS)]);
    } catch (err) {
      setError(err?.message || "Couldn't load that conversation.");
    } finally {
      setSwitching(false);
    }
  }, [conversationId, switching, applyConversation]);

  // Both throw with the server's message, for the confirm dialog to show.
  // Removing the open conversation also clears the screen
  const deleteConversation = useCallback(async (id) => {
    await apiClient.delete(`/coach/conversations/${id}`, { auth: true });
    if (id === conversationId) reset();
    await refreshHistory();
  }, [conversationId, reset, refreshHistory]);

  const deleteAllConversations = useCallback(async () => {
    await apiClient.delete("/coach/conversations", { auth: true });
    reset();
    await refreshHistory();
  }, [reset, refreshHistory]);

  // Pull-to-refresh: the history list, and the open thread unless a reply is
  // still coming in
  const reload = useCallback(async () => {
    const thread = conversationId && !sending ? applyConversation(conversationId).catch(() => {}) : null;
    await Promise.all([refreshHistory(), thread]);
  }, [conversationId, sending, applyConversation, refreshHistory]);
  usePullRefresh(reload);

  // A new conversation can't be started at the limit (continuing one can)
  const atLimit = !conversationId && conversations.length >= MAX_CONVERSATIONS;

  return {
    messages, sending, error, conversationId, send, reset, retry, subject,
    conversations, historyLoading, switching, resuming, loadConversation, refreshHistory,
    deleteConversation, deleteAllConversations, atLimit,
  };
}

// Web only: opens the default mic (the browser shows its permission prompt) and
// gives a precise error instead of a vague one
async function openWebMic() {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return { error: "Voice needs https:// (or localhost). This page isn't secure." };
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    return { error: "This browser can't record audio." };
  }
  try {
    return { stream: await navigator.mediaDevices.getUserMedia({ audio: true }) };
  } catch (e) {
    if (__DEV__) console.warn("[voice] getUserMedia failed:", e.name, e.message);
    if (e.name === "NotAllowedError" || e.name === "SecurityError")
      return { error: "Microphone is blocked. Allow it in the browser's site settings." };
    if (e.name === "NotFoundError" || e.name === "OverconstrainedError")
      return { error: "No microphone found. Plug one in or check your system's input device." };
    if (e.name === "NotReadableError") return { error: "The microphone is in use by another app." };
    return { error: "Couldn't open the microphone." };
  }
}

// A clip is cut off here, the server only takes short ones
const MAX_RECORD_MS = 120 * 1000;
const TRANSCRIBE_TIMEOUT_MS = 30 * 1000;
// National languages Whisper supports: Auto, Filipino and English first, the rest A-Z.
// Auto lets Whisper detect the language. Keep in step with the backend list in coachController
export const VOICE_LANGUAGES = [
  { code: "auto", label: "Auto" },
  { code: "tl", label: "Filipino (Tagalog)" },
  { code: "en", label: "English" },
  { code: "af", label: "Afrikaans" },
  { code: "sq", label: "Albanian" },
  { code: "am", label: "Amharic" },
  { code: "ar", label: "Arabic" },
  { code: "hy", label: "Armenian" },
  { code: "az", label: "Azerbaijani" },
  { code: "be", label: "Belarusian" },
  { code: "bn", label: "Bengali" },
  { code: "bs", label: "Bosnian" },
  { code: "bg", label: "Bulgarian" },
  { code: "my", label: "Burmese" },
  { code: "zh", label: "Chinese" },
  { code: "hr", label: "Croatian" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "nl", label: "Dutch" },
  { code: "et", label: "Estonian" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "ka", label: "Georgian" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "ht", label: "Haitian Creole" },
  { code: "ha", label: "Hausa" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "hu", label: "Hungarian" },
  { code: "is", label: "Icelandic" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "kk", label: "Kazakh" },
  { code: "km", label: "Khmer" },
  { code: "ko", label: "Korean" },
  { code: "lo", label: "Lao" },
  { code: "lv", label: "Latvian" },
  { code: "ln", label: "Lingala" },
  { code: "lt", label: "Lithuanian" },
  { code: "lb", label: "Luxembourgish" },
  { code: "mk", label: "Macedonian" },
  { code: "mg", label: "Malagasy" },
  { code: "ms", label: "Malay" },
  { code: "mt", label: "Maltese" },
  { code: "mi", label: "Maori" },
  { code: "mn", label: "Mongolian" },
  { code: "ne", label: "Nepali" },
  { code: "no", label: "Norwegian" },
  { code: "ps", label: "Pashto" },
  { code: "fa", label: "Persian" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sr", label: "Serbian" },
  { code: "sn", label: "Shona" },
  { code: "si", label: "Sinhala" },
  { code: "sk", label: "Slovak" },
  { code: "sl", label: "Slovenian" },
  { code: "so", label: "Somali" },
  { code: "es", label: "Spanish" },
  { code: "sw", label: "Swahili" },
  { code: "sv", label: "Swedish" },
  { code: "tg", label: "Tajik" },
  { code: "ta", label: "Tamil" },
  { code: "th", label: "Thai" },
  { code: "tr", label: "Turkish" },
  { code: "tk", label: "Turkmen" },
  { code: "uk", label: "Ukrainian" },
  { code: "ur", label: "Urdu" },
  { code: "uz", label: "Uzbek" },
  { code: "vi", label: "Vietnamese" },
  { code: "yo", label: "Yoruba" },
];
// Browsers record different formats; the first one this browser supports
const WEB_AUDIO_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

// Dictation into the message box, web and mobile alike. Records a short clip,
// the server turns it into text (Whisper), and the text is appended after
// whatever was already typed
export function useVoiceInput(setMessage) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [language, setLanguage] = useState("auto");
  // Native recorder; web uses MediaRecorder (webRef) for exact control of the format
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const webRef = useRef(null);
  const activeRef = useRef(false);
  const discardRef = useRef(false);
  const timerRef = useRef(null);
  const tickRef = useRef(null);
  // Each recording gets its own number and start time, so a timer left over from an
  // earlier one can never end (or message about) a newer one
  const sessionRef = useRef(0);
  const startedRef = useRef(0);
  const startingRef = useRef(false);

  const supported = WEB
    ? typeof MediaRecorder !== "undefined" && typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia
    : true;

  const transcribe = useCallback(async (file) => {
    setTranscribing(true);
    try {
      const { text } = await apiClient.uploadFile(`/coach/transcribe?language=${language}`, file, { field: "audio", auth: true, timeoutMs: TRANSCRIBE_TIMEOUT_MS });
      if (!text) return setError("Didn't catch that. Try again.");
      setMessage((prev) => `${prev.trim() ? `${prev.trim()} ` : ""}${text}`.slice(0, MAX_MESSAGE_LENGTH));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't turn that into text.");
    } finally {
      setTranscribing(false);
    }
  }, [setMessage, language]);

  // discard: stop without sending the clip off (the message was sent, or the screen closed)
  const finish = useCallback(async (discard) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearTimeout(timerRef.current);
    clearInterval(tickRef.current);
    setListening(false);
    discardRef.current = discard;

    // Web: the recorder's onstop hands the clip over once it has flushed
    if (WEB) return webRef.current?.stop();
    try {
      await recorder.stop();
      // Back to playback mode so the mic isn't held (iOS keeps the recording indicator otherwise)
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (!discard && recorder.uri) transcribe({ uri: recorder.uri, name: "voice.m4a", type: "audio/mp4" });
    } catch {
      // Not recording
    }
  }, [recorder, transcribe]);

  const stop = useCallback(() => finish(false), [finish]);
  const cancel = useCallback(() => finish(true), [finish]);

  // Stops if the screen closes mid-recording
  useEffect(() => () => { cancel(); }, [cancel]);

  const toggle = async () => {
    if (activeRef.current) return stop();
    if (transcribing || startingRef.current) return;
    startingRef.current = true;
    setError("");
    try {
      if (WEB) {
        const mic = await openWebMic();
        if (mic.error) return setError(mic.error);

        const type = WEB_AUDIO_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
        const rec = new MediaRecorder(mic.stream, type ? { mimeType: type } : undefined);
        const chunks = [];
        rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
          // Releases the mic, the browser's recording indicator goes off
          mic.stream.getTracks().forEach((t) => t.stop());
          webRef.current = null;
          if (discardRef.current || !chunks.length) return;
          const mime = (rec.mimeType || type || "audio/webm").split(";")[0];
          const blob = new Blob(chunks, { type: mime });
          transcribe({ uri: URL.createObjectURL(blob), name: `voice.${mime === "audio/mp4" ? "m4a" : "webm"}`, type: mime });
        };
        webRef.current = rec;
        rec.start();
      } else {
        // Native: RECORD_AUDIO on Android, the microphone prompt on iOS
        const { granted, canAskAgain } = await requestRecordingPermissionsAsync();
        if (!granted) {
          // Denied for good: the system won't ask again, so send them to the app's settings
          if (canAskAgain === false) {
            setError("Microphone is off for NutriFitAI. Turn it on in Settings.");
            Linking.openSettings().catch(() => {});
            return;
          }
          return setError("Allow microphone access to use voice.");
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      }
      // Always starts from zero, whatever was recorded before
      clearTimeout(timerRef.current);
      clearInterval(tickRef.current);
      const session = ++sessionRef.current;
      startedRef.current = Date.now();
      activeRef.current = true;
      setListening(true);
      // The clock shown while recording, read from the start time so it can't drift
      setSeconds(0);
      tickRef.current = setInterval(() => setSeconds(Math.floor((Date.now() - startedRef.current) / 1000)), 1000);
      timerRef.current = setTimeout(() => {
        if (sessionRef.current !== session || !activeRef.current) return;
        stop();
        setError("Recording stopped at 2 minutes.");
      }, MAX_RECORD_MS);
    } catch (e) {
      if (__DEV__) console.warn("[voice] start failed:", e);
      setError(`Voice input couldn't start${e?.message ? `: ${e.message}` : "."}`);
    } finally {
      startingRef.current = false;
    }
  };

  return { supported, listening, transcribing, error, language, setLanguage, toggle, stop, cancel, seconds, limitSeconds: MAX_RECORD_MS / 1000 };
}

export function useCoach() {
  const scrollRef = useRef(null);

  // "Ask AI Coach" from the food scanner: /ai-coach?scan=<id> or ?meal=<id>
  const { scan, meal } = useLocalSearchParams();
  const about = scan ? { scanId: String(scan) } : meal ? { mealId: String(meal) } : null;

  const [message, setMessage] = useState("");
  const chat = useCoachChat(about);
  const voice = useVoiceInput(setMessage);
  // Any conversation load, the one resumed on open or one picked from history
  const loadingThread = chat.resuming || chat.switching;
  // Empty chat: a welcome in the middle instead of a first message
  const empty = chat.messages.length === 0 && !loadingThread;

  const sendMessage = (preset) => {
    const text = (typeof preset === "string" ? preset : message).trim();
    if (!text || chat.sending || chat.atLimit) return;
    voice.cancel();
    chat.send(text);
    setMessage("");
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  };

  return { ...chat, scrollRef, message, setMessage, loadingThread, empty, sendMessage, voice };
}