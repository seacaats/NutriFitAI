import { useTheme } from "@/shared/context/ThemeContext";
import { getScreenTones, radii } from "@/shared/theme/nutrifit";

/**
 * Web counterpart of Skeleton.jsx -- same props/shape, but the pulse is a
 * plain CSS animation on a <div> rather than an Animated.Value loop, which
 * is cheaper and more idiomatic for react-native-web's DOM output
 */
export default function Skeleton({ width = "100%", height = 16, borderRadius = radii.sm, style }) {
  const { darkMode } = useTheme();
  const tone = getScreenTones(darkMode);

  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: tone.surfaceMuted,
        animation: "nutrifit-skeleton-pulse 1.4s ease-in-out infinite",
        ...styleObjectFromRN(style),
      }}
    >
      <style>{`
        @keyframes nutrifit-skeleton-pulse {
          0% { opacity: 0.45; }
          50% { opacity: 1; }
          100% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

// Best-effort: flattens a React Native `style` prop (object, or array of
// objects/falsy values) into a plain object DOM `style` can spread. Screens
// only ever pass plain margin/flex objects here, not RN-only style keys
function styleObjectFromRN(style) {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean).map(styleObjectFromRN));
  return style;
}