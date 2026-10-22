import { Image } from "expo-image";

/**
 * Native counterpart to ServerImage.web.jsx
 *
 * For native image loading with support for custom headers.
 * Passes the ngrok-skip-browser-warning header for local development tunnels.
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
