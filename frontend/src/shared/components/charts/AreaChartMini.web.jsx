import ChartBox from "@/shared/components/charts/ChartBox";
import { useTheme } from "@/shared/context/ThemeContext";
import { CHART_FONT, screenTones } from "@/shared/theme/nutrifitai";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
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
  // Keyed by position, not label: series that print only every 5th label
  // repeat "" as a category, and Recharts then showed the wrong point's value
  // (0) in the tooltip. `tip` is the full label for the tooltip, when given
  const chartData = data.map((d, i) => ({ x: i, label: d.label, tip: d.tip ?? d.label, y: d.value }));
  const labelAt = (i) => chartData[i]?.label ?? "";
  const tipAt = (i) => chartData[i]?.tip ?? "";

  // Axis labels at 11px (were 8) so they stay readable
  return (
    <ChartBox height={height}>
      {(width) => (
        <AreaChart width={width} height={height} data={chartData} margin={{ top: 5, right: 8, left: yTicks ? 0 : 5, bottom: 0 }}>
          <CartesianGrid stroke={screenTones.light.border} vertical={false} />

          {showXLabels ? (
            <XAxis
              dataKey="x"
              tickFormatter={labelAt}
              // Pre-thinned series (blank labels) print every tick; others auto-thin
              interval={chartData.some((d) => !d.label) ? 0 : "preserveEnd"}
              tick={{ fontSize: 11, fill: colors.textMuted, fontFamily: CHART_FONT }}
              axisLine={{ stroke: screenTones.dark.muted }}
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
              tick={{ fontSize: 11, fill: colors.textMuted, fontFamily: CHART_FONT }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
          ) : (
            <YAxis domain={[yMin, yMax]} hide />
          )}

          <Tooltip
            formatter={(value) => [`${value} ${unit}`.trim(), name]}
            labelFormatter={tipAt}
            contentStyle={{ fontSize: 12, fontFamily: CHART_FONT }} // tooltip is HTML, so set the app font here too
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
      )}
    </ChartBox>
  );
}