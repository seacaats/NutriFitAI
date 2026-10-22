import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import { useAuth } from "@/shared/context/AuthContext";
import { usePullRefresh } from "@/shared/context/PullRefreshContext";
import { forgetRemembered, getRemembered, setRemembered } from "@/shared/utils/rememberedState";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Platform } from "react-native";

/**
 * Shared state and actions for the AI coach screens (web and mobile).
 *
 * Manages the active conversation thread, message sending/retry, and the recent
 * conversations list (up to MAX_CONVERSATIONS, newest first). Persists the active
 * conversationId per account via rememberedState.js so threads resume across
 * remounts and reloads within RESUME_MS.
 */

const WEB = Platform.OS === "web";

// Mirrors MAX_CONVERSATIONS in coachController.js
export const MAX_CONVERSATIONS = 10;

// Mirrors MAX_MESSAGE_LENGTH in coachValidators.js; character counter appears at COUNTER_FROM
export const MAX_MESSAGE_LENGTH = 2000;
export const COUNTER_FROM = 1800;

const LAST_CONVERSATION = "coach-thread";
// Resume the last active conversation if used within 24 hours; otherwise start a fresh chat
const RESUME_MS = 24 * 60 * 60 * 1000;

// Minimum skeleton display duration when loading an existing thread to avoid visual flicker
const MIN_THREAD_LOAD_MS = 450;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let localId = 0;
const nextId = () => `local-${++localId}`;

// Formats a message timestamp in the local timezone:
//   today       "3:42 PM"
//   yesterday   "Yesterday, 3:42 PM"
//   older       "Sep 21, 3:42 PM" (includes year if from a previous year)
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
 * `about` is { scanId } or { mealId } when opened from the food scanner's
 * "Ask AI Coach" action (/ai-coach?scan= or ?meal=), which starts a fresh
 * thread scoped to that scan or meal instead of resuming the last thread.
 */
export function useCoachChat(about = null) {
  const userId = useAuth().user?.id;
  const aboutKey = about?.scanId ? `scan:${about.scanId}` : about?.mealId ? `meal:${about.mealId}` : "";

  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  // Recent conversation history (capped at 10 and sorted newest-first by the server)
  const [conversations, setConversations] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  // True while checking storage on initial mount for a thread to resume
  const [resuming, setResuming] = useState(true);
  // Subject metadata for threads started from a food scan or logged meal:
  // { kind, id, label, caloriesKcal, date, mealType? } or null
  const [subject, setSubject] = useState(null);

  const abortRef = useRef(null);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const rows = await apiClient.get("/coach/conversations", { auth: true });
      setConversations(rows);
    } catch {
      // Ignore history list fetch failures so core chat remains usable
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  /** Fetches a conversation thread and sets it as the active conversation */
  const applyConversation = useCallback(async (id) => {
    const data = await apiClient.get(`/coach/conversations/${id}`, { auth: true });
    setConversationId(data.id);
    // Mark a trailing unanswered user message as failed so the next send replaces it
    const rows = data.messages || [];
    const last = rows[rows.length - 1];
    setMessages(last?.role === "user" ? [...rows.slice(0, -1), { ...last, failed: true }] : rows);
    setSubject(data.subject || null);
    await setRemembered(LAST_CONVERSATION, userId, data.id);
    return data;
  }, [userId]);

  // On mount: load history and either start a subject-scoped thread or resume the last active conversation
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
          // Fall back to a standard chat if the referenced scan or meal was deleted
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
        // Clear stored ID if the thread was deleted or expired
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
    // Replace any prior failed user turn rather than stacking duplicate failed messages
    setMessages((current) => [...current.filter((m) => !m.failed), userMessage, placeholder]);

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    abortRef.current = controller;

    try {
      // Attach the scan or meal reference on the first message of a subject-scoped thread
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
      // Remember general threads for auto-resume on next mount
      if (!aboutKey) await setRemembered(LAST_CONVERSATION, userId, data.conversationId);
      refreshHistory();
    } catch (err) {
      const limited = err instanceof ApiClientError && err.code === "CONVERSATION_LIMIT";
      setMessages((current) => current
        .filter((m) => m.id !== placeholder.id && !(limited && m.id === userMessage.id))
        .map((m) => (m.id === userMessage.id ? { ...m, failed: true } : m)));

      // Adopt the server-created conversationId if the user message was saved before the reply failed
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

  /** Starts a fresh conversation while keeping past threads in server history */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setSubject(null);
    setError("");
    forgetRemembered(LAST_CONVERSATION, userId);
  }, [userId]);

  /** Re-sends the last failed user message */
  const retry = useCallback(() => {
    const failed = [...messages].reverse().find((m) => m.role === "user" && m.failed);
    if (failed) send(failed.content);
  }, [messages, send]);

  /** Loads and activates a conversation selected from the history list */
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

  const reload = useCallback(async () => {
    const thread = conversationId && !sending ? applyConversation(conversationId).catch(() => {}) : null;
    await Promise.all([refreshHistory(), thread]);
  }, [conversationId, sending, applyConversation, refreshHistory]);
  usePullRefresh(reload);

  // Block starting a new conversation when the user has reached MAX_CONVERSATIONS
  const atLimit = !conversationId && conversations.length >= MAX_CONVERSATIONS;

  return {
    messages, sending, error, conversationId, send, reset, retry, subject,
    conversations, historyLoading, switching, resuming, loadConversation, refreshHistory,
    deleteConversation, deleteAllConversations, atLimit,
  };
}

// Opens the browser microphone and maps MediaDevices errors to user-facing messages
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

const MAX_RECORD_MS = 120 * 1000;
const TRANSCRIBE_TIMEOUT_MS = 30 * 1000;
// Supported Whisper languages (Auto, Filipino, and English first, then alphabetical; matches coachController)
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
const WEB_AUDIO_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

// Records a voice clip on web or mobile, transcribes it via /coach/transcribe, and appends it to the message input
export function useVoiceInput(setMessage) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [language, setLanguage] = useState("auto");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const webRef = useRef(null);
  const activeRef = useRef(false);
  const discardRef = useRef(false);
  const timerRef = useRef(null);
  const tickRef = useRef(null);
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

  // Stops recording; when `discard` is true, drops the audio clip without transcribing
  const finish = useCallback(async (discard) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearTimeout(timerRef.current);
    clearInterval(tickRef.current);
    setListening(false);
    discardRef.current = discard;

    if (WEB) return webRef.current?.stop();
    try {
      await recorder.stop();
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (!discard && recorder.uri) transcribe({ uri: recorder.uri, name: "voice.m4a", type: "audio/mp4" });
    } catch {
      // Not recording
    }
  }, [recorder, transcribe]);

  const stop = useCallback(() => finish(false), [finish]);
  const cancel = useCallback(() => finish(true), [finish]);

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
        const { granted, canAskAgain } = await requestRecordingPermissionsAsync();
        if (!granted) {
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
      clearTimeout(timerRef.current);
      clearInterval(tickRef.current);
      const session = ++sessionRef.current;
      startedRef.current = Date.now();
      activeRef.current = true;
      setListening(true);
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
  const loadingThread = chat.resuming || chat.switching;
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
