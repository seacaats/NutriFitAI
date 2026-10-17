// Web has no push here (browser Web Push would be a separate setup). The
// inbox and account emails still reach web users. Same API as push.js

export async function registerDevice() {
  return "unavailable";
}

export async function unregisterDevice() {}

export async function getPushState() {
  return null;
}

export async function disableDevice() {
  return "off";
}

export function onNotificationTap() {
  return () => {};
}