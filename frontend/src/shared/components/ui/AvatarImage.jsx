import { Image } from "expo-image";

/**
 * Native counterpart to AvatarImage.web.jsx
 *
 * Why this exists at all: avatars are the only images this app loads from
 * its own API host rather than bundled assets, and during local dev that
 * host is a free ngrok tunnel. Free ngrok serves an HTML "you're about to
 * visit..." interstitial to any GET that looks like it came from a browser
 * and lacks the `ngrok-skip-browser-warning` header -- apiClient already
 * adds that header to every JSON request (see its own ngrok comment), which
 * is exactly why "everything except avatars" loads fine: the JSON calls
 * carry the header, but a plain <Image source={{ uri }}> request never did.
 *
 * expo-image supports per-request headers directly, so on native this is
 * the entire fix. Web's <img> can't set custom headers at all -- that's
 * what AvatarImage.web.jsx's fetch+blob workaround is for
 */
export default function AvatarImage({ uri, style, contentFit = "cover", onError }) {
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