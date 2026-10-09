import { Image } from "expo-image";

/**
 * Native counterpart to ServerImage.web.jsx
 *
 * Images stored on the server: avatars and food scan photos. Why this exists
 * at all: during local dev the API host is a free ngrok tunnel, and free
 * ngrok serves an HTML "you're about to visit..." interstitial to any GET
 * that looks like it came from a browser and lacks the
 * `ngrok-skip-browser-warning` header -- apiClient already adds that header
 * to every JSON request (see its own ngrok comment), which is why the data
 * loads fine while images didn't: a plain <Image source={{ uri }}> request
 * never carried it.
 *
 * expo-image supports per-request headers directly, so on native this is
 * the entire fix. Web's <img> can't set custom headers at all -- that's
 * what ServerImage.web.jsx's fetch+blob workaround is for
 */
export default function ServerImage({ uri, style, contentFit = "cover", onError }) {
  if (!uri) return null;

  return (
    <Image
      source={{ uri, headers: { "ngrok-skip-browser-warning": "true" } }}
      style={style}
      contentFit={contentFit}
      onError={onError}
    />
  );
}