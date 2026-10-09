import NetInfo from "@react-native-community/netinfo";
import { AppState, Platform } from "react-native";

// Whether the server can be reached right now. Flipped offline by
// apiClient when a request can't get through; while offline the server's
// /health is checked every few seconds (and right away when the browser
// reports a network or the app comes back to the foreground), and the
// first answer flips it back online and tells every listener to reload

const POLL_MS = 5000;
const PING_TIMEOUT_MS = 4000;

let offline = false;
// The device itself has no connection (NetInfo). Offline without this
// means the network is fine and the server is what's down
let noConnection = false;
// Oldest saved copy on screen while offline, for the banner (null: none)
let savedSince = null;
let pingUrl = null;
let timer = null;
const reconnectListeners = new Set();
const stateListeners = new Set();

export const isOffline = () => offline;
export const hasNoConnection = () => noConnection;
export const getSavedSince = () => savedSince;

// A screen is showing a saved copy from `at`
export function noteSavedData(at) {
  // A late answer from before the server came back: nothing to show
  if (!offline) return;
  const next = savedSince ? Math.min(savedSince, at) : at;
  if (next === savedSince) return;
  savedSince = next;
  emitState();
}

// /api/... lives under the same host as /health
export function setPingBase(apiBaseUrl) {
  pingUrl = `${apiBaseUrl.replace(/\/api\/?$/, "")}/health`;
}

function emitState() {
  stateListeners.forEach((fn) => fn(offline));
}

export function setOffline() {
  if (offline) return;
  offline = true;
  emitState();
  if (!timer) timer = setInterval(ping, POLL_MS);
}

export function setOnline() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  if (!offline) {
    // Can still be set by a saved copy read in the same moment
    if (savedSince) {
      savedSince = null;
      emitState();
    }
    return;
  }
  offline = false;
  savedSince = null;
  emitState();
  reconnectListeners.forEach((fn) => fn());
}

// Check now instead of at the next tick (an action or load was just tried)
export const checkNow = () => offline && ping();

async function ping() {
  if (!pingUrl) return;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    const res = await fetch(pingUrl, { headers: { "ngrok-skip-browser-warning": "true" }, signal: controller.signal });
    // Any answer means the server is up
    if (res.status < 500) setOnline();
  } catch (err) {
    // Still unreachable; the next tick tries again. Logged in development:
    // if this keeps failing while the app works, the URL below is wrong
    if (__DEV__) console.log(`[connection] ${pingUrl} unreachable:`, err?.message);
  } finally {
    clearTimeout(t);
  }
}

// Every screen reload hooks in here
export function onReconnect(fn) {
  reconnectListeners.add(fn);
  return () => reconnectListeners.delete(fn);
}

export function onConnectionChange(fn) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}

// Resolves the next time the server answers
export function waitForOnline() {
  if (!offline) return Promise.resolve();
  return new Promise((resolve) => {
    const off = onReconnect(() => {
      off();
      resolve();
    });
  });
}

// The device's own connection. Losing it marks the server unreachable at
// once, rather than after a request times out; getting it back checks the
// server straight away
NetInfo.addEventListener((state) => {
  // No network at all. Not isInternetReachable: in development the server
  // is on the LAN, reachable on Wi-Fi that has no internet
  const none = state.isConnected === false;
  if (none === noConnection) return;
  noConnection = none;
  if (none) {
    setOffline();
    emitState();
  } else {
    emitState();
    if (offline) ping();
  }
});

// Back in the foreground: check at once instead of waiting for the next poll
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (s) => s === "active" && offline && ping());
}