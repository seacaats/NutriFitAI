// Central error alert state for ScreenAlert. Displays the most recent error source.

let entries = new Map(); // id -> { message, onDismiss, at }
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function setScreenError(id, message, onDismiss) {
  const next = new Map(entries);
  if (message) next.set(id, { message, onDismiss, at: entries.get(id)?.message === message ? entries.get(id).at : Date.now() });
  else next.delete(id);
  entries = next;
  emit();
}

const clearScreenError = (id) => setScreenError(id, "");

export function currentScreenError() {
  let top = null;
  entries.forEach((e, id) => {
    if (!top || e.at > top.at) top = { ...e, id };
  });
  return top;
}

// Dismisses an error by message content across all registered ids
export function dismissScreenError(message) {
  const next = new Map(entries);
  entries.forEach((e, id) => {
    if (e.message !== message) return;
    e.onDismiss?.();
    next.delete(id);
  });
  entries = next;
  emit();
}

export function subscribeScreenErrors(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Network error identifier
const NETWORK_ID = "network";
export const reportNetworkError = (message) => setScreenError(NETWORK_ID, message);
export const clearNetworkError = () => clearScreenError(NETWORK_ID);

// Updates the network error message if currently active
export function rewordNetworkError(message) {
  if (entries.has(NETWORK_ID)) setScreenError(NETWORK_ID, message);
}
