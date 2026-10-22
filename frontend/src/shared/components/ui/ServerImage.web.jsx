import { API_BASE_URL } from "@/shared/api/apiClient";
import { Image } from "expo-image";
import { useEffect, useState } from "react";

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

// Checks whether the image is served by the backend API host rather than external storage (e.g. R2 or Google)
const isOurs = (uri) => (API_ORIGIN ? uri.startsWith(API_ORIGIN) : uri.startsWith("/"));

/**
 * Web counterpart to ServerImage.jsx (native).
 * Browser <img> tags cannot set custom request headers directly. For API origin
 * images going through local development tunnels (ngrok), this fetches the blob with the
 * ngrok-skip-browser-warning header and creates an object URL. External storage URLs render directly.
 */
export default function ServerImage({ uri, style, contentFit = "cover", onError }) {
  const [resolvedUri, setResolvedUri] = useState(null);

  useEffect(() => {
    if (!uri) {
      setResolvedUri(null);
      return undefined;
    }

    if (!isOurs(uri)) {
      setResolvedUri(uri);
      return undefined;
    }

    let cancelled = false;
    let objectUrl = null;

    fetch(uri, { headers: { "ngrok-skip-browser-warning": "true" } })
      .then((res) => {
        if (!res.ok) throw new Error(`Avatar fetch failed with status ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedUri(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedUri(null);
          onError?.();
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [uri]);

  if (!resolvedUri) return null;

  return <Image source={{ uri: resolvedUri }} style={style} contentFit={contentFit} />;
}
