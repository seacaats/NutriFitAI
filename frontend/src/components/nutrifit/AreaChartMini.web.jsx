import { useTheme } from "@context/ThemeContext";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

export default function AreaChartMini({
  data,
  height,
  stroke,
  fill,
  yMin,
  yMax,
  yTicks,
  yTickFormat,
  showXLabels = true,
  dotRadius = 3,
  name = "Value",
  unit = ""
}) {
  const { tokens } = useTheme();
  const { colors } = tokens;
  const chartData = data.map((d) => ({ x: d.label, y: d.value }));

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 8, left: yTicks ? 0 : 5, bottom: 0 }}>
          <CartesianGrid stroke="#e5e7eb" vertical={false} />

          {showXLabels ? (
            <XAxis
              dataKey="x"
              tick={{ fontSize: 8, fill: colors.textMuted }}
              axisLine={{ stroke: "#9ca3af" }}
              tickLine={false}
            />
          ) : (
            <XAxis dataKey="x" hide />
          )}

          {yTicks ? (
            <YAxis
              domain={[yMin, yMax]}
              ticks={yTicks}
              tickFormatter={yTickFormat}
              tick={{ fontSize: 8, fill: colors.textMuted }}
              axisLine={false}
              tickLine={false}
              width={30}
            />
          ) : (
            <YAxis domain={[yMin, yMax]} hide />
          )}

          <Tooltip
            formatter={(value) => [`${value} ${unit}`, name]}
            contentStyle={{ fontSize: 12 }}
          />

          <Area
            type="monotone"
            dataKey="y"
            name={name}
            stroke={stroke}
            strokeWidth={2}
            fill={fill}
            fillOpacity={0.8}
            dot={{ r: dotRadius, fill: stroke, strokeWidth: 0 }}
            activeDot={{ r: dotRadius + 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}