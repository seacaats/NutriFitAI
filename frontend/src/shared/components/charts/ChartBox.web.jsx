import { useEffect, useRef, useState } from "react";

// Measures its own width and renders the chart only once it's above 0.
// Replaces Recharts' ResponsiveContainer, which warns on every render while
// its box is 0 wide (first paint, or a card that hasn't laid out yet)
export default function ChartBox({ height, children }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: "100%", height }}>
      {width > 0 ? children(width) : null}
    </div>
  );
}