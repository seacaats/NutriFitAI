import { screenTones } from "@/shared/theme/nutrifit";
import { StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

export default function DonutChart({
  segments,
  size = 96,
  strokeWidth = 15,
  centerBg,
  children,
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const safeSegments = (segments ?? []).filter(
    (s) => Number.isFinite(s.value) && s.value > 0
  );
  const total = safeSegments.reduce((sum, s) => sum + s.value, 0);

  let offsetAcc = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: [{ rotate: "-90deg" }] }}
      >
        {total > 0 &&
          safeSegments.map((s, i) => {
            const fraction = s.value / total;
            const dash = fraction * circumference;
            const dashOffset = -offsetAcc;
            offsetAcc += dash;
            return (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={s.color ?? "#ccc"}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={dashOffset}
                fill="none"
              />
            );
          })}
        {total === 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={screenTones.light.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
        )}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius - strokeWidth / 2}
          fill={centerBg}
        />
      </Svg>
      <View style={styles.centerContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});