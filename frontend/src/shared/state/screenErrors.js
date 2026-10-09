// Every error on a screen funnels into one alert under the screen's title
// (ScreenAlert). Each source is an entry; the newest one shows

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

// X: closes this message everywhere it's showing, so a twin doesn't pop up
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

// apiClient's own source: can't reach the server / offline
const NETWORK_ID = "network";
export const reportNetworkError = (message) => setScreenError(NETWORK_ID, message);
export const clearNetworkError = () => clearScreenError(NETWORK_ID);

// Rewords the connection message if one is showing (Wi-Fi came back but the
// server is still down, say)
export function rewordNetworkError(message) {
  if (entries.has(NETWORK_ID)) setScreenError(NETWORK_ID, message);
}