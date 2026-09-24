import { useTheme } from "@/shared/context/ThemeContext";
import { screenTones, shellColors } from "@/shared/theme/nutrifit";
import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

// draws charts with react-native-svg followning the same approach/props

export default function AreaChartMini({
  data,
  height = 140,
  // Defensive defaults: if a caller ever forgets to pass `stroke`/`fill` (or
  // passes an accidentally-undefined value), SVG's own default paint is
  // black, which reads as "the whole chart is solid black". Falling back to
  // sane brand colors here means a missing prop degrades to "wrong color"
  // instead of "unreadable chart", regardless of which call site is at fault
  stroke = shellColors.primary,
  fill = shellColors.light.activeNavBg,
  yMin,
  yMax,
  yTicks,
  yTickFormat,
  showXLabels = true,
  dotRadius = 3,
}) {
  const { tokens } = useTheme();
  const { colors } = tokens;
  const [width, setWidth] = useState(0);

  if (!data || data.length === 0) return <View style={{ width: "100%", height }} />;

  const padLeft = yTicks ? 26 : 6;
  const padRight = 10;
  const padTop = 8;
  const padBottom = showXLabels ? 16 : 4;

  const min = yMin ?? Math.min(...data.map((d) => d.value));
  const max = yMax ?? Math.max(...data.map((d) => d.value));

  const plotW = Math.max(width - padLeft - padRight, 1);
  const plotH = Math.max(height - padTop - padBottom, 1);

  const xFor = (i) => padLeft + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const yFor = (v) => padTop + plotH - ((v - min) / (max - min || 1)) * plotH;

  const points = data.map((d, i) => ({ x: xFor(i), y: yFor(d.value) }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padTop + plotH} L ${points[0].x} ${padTop + plotH} Z`
      : "";

  return (
    <View style={{ width: "100%", height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {/* Gridlines + y labels */}
          {yTicks?.map((t, i) => (
            <Line key={`grid-${i}`} x1={padLeft} y1={yFor(t)} x2={width - padRight} y2={yFor(t)} stroke={screenTones.light.border} strokeWidth={1} />
          ))}
          {yTicks?.map((t, i) => (
            <SvgText key={`ylabel-${i}`} x={padLeft - 6} y={yFor(t) + 3} fontSize={9} fill={colors.textMuted} textAnchor="end">
              {yTickFormat ? yTickFormat(t) : `${t}`}
            </SvgText>
          ))}

          {/* Area + line. `fillOpacity` (not the bare `opacity` prop) is used
              deliberately: `opacity` fades the whole element -- fill AND
              stroke/children -- while this path only ever draws a fill, so
              `fillOpacity` is the precise prop for what's intended and avoids
              any ambiguity some react-native-svg/Fabric combinations have
              had with a bare numeric `opacity` on <Path> */}
          <Path d={areaPath} fill={fill} fillOpacity={0.85} />
          <Path d={linePath} stroke={stroke} strokeWidth={2} fill="none" />

          {/* Dots */}
          {points.map((p, i) => (
            <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={dotRadius} fill={stroke} />
          ))}

          {/* X labels */}
          {showXLabels &&
            data.map((d, i) => (
              <SvgText key={`xlabel-${i}`} x={xFor(i)} y={height - 4} fontSize={9} fill={colors.textMuted} textAnchor="middle">
                {d.label}
              </SvgText>
            ))}
        </Svg>
      )}
    </View>
  );
}