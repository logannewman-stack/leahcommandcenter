import React from "react";

/**
 * A trend tile's little chart: an area for money, bars for counts. Drawn
 * as one SVG in the tile's tone, so there is no chart library to load. The
 * tile around it says the numbers in words (`aria-label` on its wrapper).
 *
 * @param {{ data: { label: string, value: number }[], type?: "area"|"bar", height?: number }} props
 */
export default function Sparkline({ data = [], type = "bar", height = 80 }) {
  const width = 300;
  const top = 6;
  const max = Math.max(1, ...data.map((d) => d.value));
  const y = (value) => height - 2 - ((height - 2 - top) * value) / max;

  if (type === "area") {
    const step = data.length > 1 ? width / (data.length - 1) : width;
    const points = data.map((d, i) => [i * step, y(d.value)]);
    const line = points.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
    const area = `${line} L${width},${height} L0,${height} Z`;
    return (
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden="true" style={{ display: "block", color: "var(--tone)" }}>
        <path d={area} fill="currentColor" opacity="0.16" />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    );
  }

  const slot = width / Math.max(1, data.length);
  const bar = Math.max(2, slot * 0.62);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden="true" style={{ display: "block", color: "var(--tone)" }}>
      <line x1="0" x2={width} y1={height - 1} y2={height - 1} stroke="currentColor" opacity="0.18" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {data.map((d, i) => {
        const h = d.value > 0 ? Math.max(3, height - 2 - y(d.value)) : 0;
        return h ? (
          <rect key={d.label + i} x={i * slot + (slot - bar) / 2} y={height - 2 - h} width={bar} height={h} rx="2" fill="currentColor" opacity={i === data.length - 1 ? 1 : 0.55} />
        ) : null;
      })}
    </svg>
  );
}
