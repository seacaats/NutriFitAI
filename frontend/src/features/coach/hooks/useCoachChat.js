import { apiClient, ApiClientError } from "@/shared/api/apiClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

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
 * navigates away. The fix is below — the active id is mirrored to storage and
 * rehydrated on mount, so a thread keeps growing across reloads instead of
 * forking a fresh one every time
 */

// A function rather than a shared constant object: this fixture is re-used
// as the starting point of a fresh chat (reset(), and the initial mount)
// every time, so it needs a fresh "sent just now" timestamp on each of those
// occasions instead of freezing at whatever time the module first loaded
const makeGreeting = () => ({
  id: "greeting",
  role: "assistant",
  content: "Hi! I'm your NutriFit coach. Ask me about your steps, meals, workouts, or how you're tracking against your goals.",
  pending: false,
  createdAt: new Date().toISOString(),
});

const LAST_CONVERSATION_KEY = "nutrifit.coach.lastConversationId";

let localId = 0;
const nextId = () => `local-${++localId}`;

export function useCoachChat() {
  const [messages, setMessages] = useState(() => [makeGreeting()]);
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
    setMessages(data.messages.length ? data.messages : [makeGreeting()]);
    await AsyncStorage.setItem(LAST_CONVERSATION_KEY, data.id);
    return data;
  }, []);

  // On mount: populate the history list, and resume whichever thread was last
  // active rather than always starting blank
  useEffect(() => {
    let cancelled = false;

    refreshHistory();

    (async () => {
      const storedId = await AsyncStorage.getItem(LAST_CONVERSATION_KEY);
      if (!storedId || cancelled) {
        if (!cancelled) setResuming(false);
        return;
      }
      try {
        await applyConversation(storedId);
      } catch {
        // Thread is gone (deleted, or aged out past the 180-day TTL) — drop
        // the stale pointer and fall back to a fresh greeting
        await AsyncStorage.removeItem(LAST_CONVERSATION_KEY);
      } finally {
        if (!cancelled) setResuming(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const send = useCallback(async (raw) => {
    const message = String(raw || "").trim();
    if (!message || sending) return;

    setError("");
    setSending(true);

    const userMessage = { id: nextId(), role: "user", content: message, createdAt: new Date().toISOString() };
    const placeholder = { id: nextId(), role: "assistant", content: "", pending: true };
    setMessages((current) => [...current, userMessage, placeholder]);

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    abortRef.current = controller;

    try {
      const data = await apiClient.post(
        "/coach/chat",
        { message, ...(conversationId ? { conversationId } : {}) },
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
      // Keep resuming this same thread on the next mount/reload
      await AsyncStorage.setItem(LAST_CONVERSATION_KEY, data.conversationId);
      // New/updated thread moves to the top of the list, same as the
      // server's own updatedAt-desc order
      refreshHistory();
    } catch (err) {
      // Drop the placeholder rather than leaving an empty bubble spinning.
      setMessages((current) => current.filter((m) => m.id !== placeholder.id));

      setError(
        err instanceof ApiClientError && err.code === "AI_UNAVAILABLE"
          ? "The coach is unavailable right now. Please try again in a moment."
          : err?.message || "Couldn't reach the coach.",
      );
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }, [conversationId, sending, refreshHistory]);

  /** Starts a fresh thread; the old one stays in history on the server */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([makeGreeting()]);
    setConversationId(null);
    setError("");
    AsyncStorage.removeItem(LAST_CONVERSATION_KEY);
  }, []);

  /** Re-sends the last user turn after a failure, without retyping it */
  const retry = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) send(lastUser.content);
  }, [messages, send]);

  /** Swaps in a past thread picked from the history list */
  const loadConversation = useCallback(async (id) => {
    if (!id || id === conversationId || switching) return;
    abortRef.current?.abort();
    setSwitching(true);
    setError("");
    try {
      await applyConversation(id);
    } catch (err) {
      setError(err?.message || "Couldn't load that conversation.");
    } finally {
      setSwitching(false);
    }
  }, [conversationId, switching, applyConversation]);

  return {
    messages, sending, error, conversationId, send, reset, retry,
    conversations, historyLoading, switching, resuming, loadConversation, refreshHistory,
  };
}