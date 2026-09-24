import { Image } from "expo-image";
import { useState } from "react";

export default function WorkoutImage({ uri, fallbackUri, style }) {
  const [failed, setFailed] = useState(false);

  return (
    <Image
      source={{ uri: failed ? fallbackUri : uri }}
      style={style}
      contentFit="cover"
      cachePolicy="memory-disk"
      priority="low"
      transition={150}
      onError={() => {
        if (!failed && fallbackUri && uri !== fallbackUri) setFailed(true);
      }}
    />
  );
}
