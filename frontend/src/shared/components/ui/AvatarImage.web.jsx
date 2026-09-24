import { API_BASE_URL } from "@/shared/api/apiClient";
import { Image } from "expo-image";
import { useEffect, useState } from "react";

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

/**
 * Web counterpart to AvatarImage.jsx (native). See that file's comment for
 * the underlying problem: a free ngrok tunnel serves an HTML interstitial
 * instead of the image to any request missing the `ngrok-skip-browser-warning`
 * header, and apiClient's JSON calls carry that header while a plain
 * <img>/expo-image request never did -- which is exactly why every other
 * piece of user data loads but avatars don't
 *
 * Native fixes this by setting the header on the image request directly,
 * but a browser <img> tag (which is what expo-image renders to on web)
 * cannot set custom request headers at all. The workaround: fetch the image
 * ourselves with `fetch`, where headers ARE settable, and hand the resulting
 * blob to <Image> as an object URL instead of the original network URL.
 *
 * This only applies to avatars actually served by OUR OWN API host (the one
 * behind the tunnel). A Google-hosted avatar URL (lh3.googleusercontent.com,
 * from a Google-linked account) is a different origin entirely -- fetching
 * it here would risk a CORS failure for no reason, since it was never
 * subject to the ngrok interstitial in the first place. Those render
 * directly, unchanged
 */
export default function AvatarImage({ uri, style, contentFit = "cover", onError }) {
  const [resolvedUri, setResolvedUri] = useState(null);

  useEffect(() => {
    if (!uri) {
      setResolvedUri(null);
      return undefined;
    }

    if (!uri.startsWith(API_ORIGIN)) {
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