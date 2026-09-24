/**
 * Cross-window transport for the Google OAuth popup result.
 * Both transports used here are origin-scoped rather than window-scoped, so
 * COOP does not affect them:
 *   1. BroadcastChannel — the primary path.
 *   2. localStorage + the `storage` event — the fallback, for browsers where
 *      BroadcastChannel is unavailable or partitioned. `storage` fires in
 *      every *other* same-origin document, which is exactly the opener.
 *
 * Delivery is confirmed with an explicit ack. A sender must never close the
 * channel or the window on the same tick as a post: dispatch is asynchronous,
 * so tearing the sender down immediately drops the message before it is flushed
 */

export const GOOGLE_AUTH_CHANNEL = "google-auth-channel";
export const GOOGLE_AUTH_MESSAGE_TYPE = "google-auth-result";
export const GOOGLE_AUTH_ACK_TYPE = "google-auth-ack";

/** localStorage keys for the fallback transport. */
const RESULT_KEY = "nutrifit.googleAuth.result";
const ACK_KEY = "nutrifit.googleAuth.ack";

/** A result older than this is a leftover from an abandoned attempt. */
const MESSAGE_TTL_MS = 2 * 60 * 1000;

function hasWindow() {
  return typeof window !== "undefined";
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeStorage(key, payload) {
  if (!hasWindow() || !window.localStorage) return;
  try {
    // Remove first so two consecutive identical payloads still fire `storage`
    // (the event only fires when the stored value actually changes).
    window.localStorage.removeItem(key);
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Private mode / quota / disabled storage — BroadcastChannel still applies.
  }
}

function clearStorage(key) {
  if (!hasWindow() || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // nothing to do
  }
}

function openChannel() {
  if (typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(GOOGLE_AUTH_CHANNEL);
  } catch {
    return null;
  }
}

function isFresh(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (!payload.sentAt) return true;
  return Date.now() - payload.sentAt < MESSAGE_TTL_MS;
}

/**
 * Opener side. Starts listening for a popup result and acks whatever arrives
 * @param {(result: object) => void} onResult called at most once
 * @returns {() => void} stop listening
 */
export function listenForGoogleResult(onResult) {
  if (!hasWindow()) return () => {};

  let done = false;
  const channel = openChannel();

  function ack() {
    const ackPayload = { type: GOOGLE_AUTH_ACK_TYPE, sentAt: Date.now() };
    try {
      channel?.postMessage(ackPayload);
    } catch {
      // fall through to the storage ack
    }
    writeStorage(ACK_KEY, ackPayload);
  }

  function deliver(payload) {
    if (done) return;
    if (!payload || payload.type !== GOOGLE_AUTH_MESSAGE_TYPE) return;
    if (!isFresh(payload)) return;

    done = true;
    ack();
    // The result key is consumed, so a page reload can't replay it
    clearStorage(RESULT_KEY);
    onResult(payload);
  }

  if (channel) channel.onmessage = (event) => deliver(event?.data);

  function onStorage(event) {
    if (event.key !== RESULT_KEY) return;
    deliver(safeParse(event.newValue));
  }
  window.addEventListener("storage", onStorage);

  // The popup may have written its result before this listener was attached
  // (very fast provider, or the opener was busy rendering)
  deliver(safeParse(window.localStorage?.getItem(RESULT_KEY)));

  return function stop() {
    window.removeEventListener("storage", onStorage);
    // Deferred so a just-sent ack is flushed before the channel goes away.
    setTimeout(() => {
      try {
        channel?.close();
      } catch {
        // already closed
      }
    }, 300);
  };
}

/**
 * Popup side. Publishes the result on every available transport and resolves
 * once the opener acks, or false if nobody answered in time
 * @param {object} result
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
export function publishGoogleResult(result, timeoutMs = 2500) {
  if (!hasWindow()) return Promise.resolve(false);

  return new Promise((resolve) => {
    const payload = { type: GOOGLE_AUTH_MESSAGE_TYPE, sentAt: Date.now(), ...result };
    const channel = openChannel();
    let settled = false;
    let timer = null;

    function settle(delivered) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("storage", onStorage);
      if (delivered) clearStorage(RESULT_KEY);
      clearStorage(ACK_KEY);
      // Deferred close: closing in the same tick as postMessage is what drops
      // the message before the browser dispatches it.
      setTimeout(() => {
        try {
          channel?.close();
        } catch {
          // already closed
        }
      }, 0);
      resolve(delivered);
    }

    function onAck(data) {
      if (data && data.type === GOOGLE_AUTH_ACK_TYPE) settle(true);
    }

    function onStorage(event) {
      if (event.key !== ACK_KEY) return;
      onAck(safeParse(event.newValue));
    }

    if (channel) channel.onmessage = (event) => onAck(event?.data);
    window.addEventListener("storage", onStorage);

    timer = setTimeout(() => settle(false), timeoutMs);

    // Transport 1: BroadcastChannel
    try {
      channel?.postMessage(payload);
    } catch {
      // fall through
    }

    // Transport 2: localStorage -> `storage` event in the opener
    writeStorage(RESULT_KEY, payload);

    // Transport 3: the direct opener handle, when COOP didn't sever it
    try {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(payload, window.location.origin);
      }
    } catch {
      // Severed or cross-origin 
    }
  });
}

// Drop any stale result/ack left behind by an abandoned attempt.
export function resetGoogleAuthChannel() {
  clearStorage(RESULT_KEY);
  clearStorage(ACK_KEY);
}