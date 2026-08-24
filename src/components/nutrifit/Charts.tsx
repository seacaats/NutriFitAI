import { colors } from "@/theme/nutrifit";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Path, Polyline } from "react-native-svg";

type Point = { label: string; value: number };

export function LineChart({
  data,
  height = 180,
  color = colors.primary,
  maxOverride,
}: {
  data: Point[];
  height?: number;
  color?: string;
  maxOverride?: number;
}) {
  const width = 320;
  const padding = 24;
  const max = maxOverride ?? Math.max(...data.map((d) => d.value)) * 1.2;
  const min = 0;
  const stepX = (width - padding * 2) / (data.length - 1);

  const points = data.map((d, i) => {
    const x = padding + i * stepX;
    const y = height - padding - ((d.value - min) / (max - min)) * (height - padding * 2);
    return { x, y };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = `${padding},${height - padding} ${polylinePoints} ${width - padding},${height - padding}`;

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path d={`M ${areaPoints.split(" ").join(" L ")} Z`} fill={color} fillOpacity={0.15} />
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={color} />
        ))}
      </Svg>
      <View style={styles.xLabelsRow}>
        {data.map((d) => (
          <Text key={d.label} style={styles.xLabel}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

type Slice = { label: string; pct: number; color: string };

export function DonutChart({ data, size = 160, strokeWidth = 24 }: { data: Slice[]; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {data.map((slice) => {
          const dash = (slice.pct / 100) * circumference;
          const gap = circumference - dash;
          const offset = -((cumulative / 100) * circumference);
          cumulative += slice.pct;
          return (
            <Circle
              key={slice.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset}
              fill="none"
            />
          );
        })}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  xLabelsRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginTop: 4 },
  xLabel: { fontSize: 11, color: colors.textMuted },
});
