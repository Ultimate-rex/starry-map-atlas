import { useMemo } from "react";
import type { GeoProjection } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { computeMetrics, formatKm, type Pt } from "@/lib/geoMetrics";

type Props = {
  feature: Feature<Geometry, unknown>;
  projection: GeoProjection;
  k: number;
  runKey: string | number;
};

const TICKS = 10;

/**
 * Dotted X/Y measurement grid drawn over the focused country:
 * bounding box, tick axes, N-S and E-W extent lines, and the
 * longest cross-country route.
 */
export function MeasureLayer({ feature, projection, k, runKey }: Props) {
  const m = useMemo(() => computeMetrics(feature), [feature]);

  const p = (pt: Pt) => projection(pt) ?? [0, 0];

  const [[minLon, minLat], [maxLon, maxLat]] = m.bounds;
  const c0 = p([minLon, maxLat]); // top-left in screen space
  const c1 = p([maxLon, minLat]); // bottom-right
  const x0 = Math.min(c0[0], c1[0]);
  const x1 = Math.max(c0[0], c1[0]);
  const y0 = Math.min(c0[1], c1[1]);
  const y1 = Math.max(c0[1], c1[1]);

  const w = x1 - x0;
  const h = y1 - y0;
  const pad = Math.max(w, h) * 0.08;
  const ax = x0 - pad; // y-axis position
  const ay = y1 + pad; // x-axis position

  const sw = (n: number) => n / k;
  const fs = (n: number) => n / k;
  const dash = (a: number, b: number) => `${a / k} ${b / k}`;

  const north = p(m.north);
  const south = p(m.south);
  const west = p(m.west);
  const east = p(m.east);
  const la = p(m.longest[0]);
  const lb = p(m.longest[1]);

  const tickLen = pad * 0.35;

  return (
    <g key={runKey} pointerEvents="none">
      {/* dotted bounding box */}
      <rect
        x={x0}
        y={y0}
        width={w}
        height={h}
        fill="none"
        stroke="var(--state-line)"
        strokeOpacity={0.5}
        strokeWidth={sw(0.6)}
        strokeDasharray={dash(1.5, 3)}
        className="axis-dotted"
      />

      {/* X axis */}
      <g className="axis-grow-x" style={{ transformOrigin: `${x0}px ${ay}px` }}>
        <line
          x1={x0}
          y1={ay}
          x2={x1}
          y2={ay}
          stroke="var(--state-line)"
          strokeWidth={sw(0.7)}
          strokeDasharray={dash(1, 2)}
          className="axis-dotted"
        />
        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const tx = x0 + (w * i) / TICKS;
          const major = i % 5 === 0;
          return (
            <line
              key={`xt-${i}`}
              x1={tx}
              y1={ay}
              x2={tx}
              y2={ay + (major ? tickLen : tickLen * 0.5)}
              stroke="var(--state-line)"
              strokeOpacity={major ? 0.9 : 0.5}
              strokeWidth={sw(0.5)}
            />
          );
        })}
        <text
          x={(x0 + x1) / 2}
          y={ay + tickLen * 2.6}
          textAnchor="middle"
          fill="var(--state-line)"
          fontSize={fs(6)}
          letterSpacing={fs(0.6)}
        >
          {`E–W  ${formatKm(m.widthKm)}`}
        </text>
      </g>

      {/* Y axis */}
      <g className="axis-grow-y" style={{ transformOrigin: `${ax}px ${y1}px` }}>
        <line
          x1={ax}
          y1={y0}
          x2={ax}
          y2={y1}
          stroke="var(--state-line)"
          strokeWidth={sw(0.7)}
          strokeDasharray={dash(1, 2)}
          className="axis-dotted"
        />
        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const ty = y0 + (h * i) / TICKS;
          const major = i % 5 === 0;
          return (
            <line
              key={`yt-${i}`}
              x1={ax}
              y1={ty}
              x2={ax - (major ? tickLen : tickLen * 0.5)}
              y2={ty}
              stroke="var(--state-line)"
              strokeOpacity={major ? 0.9 : 0.5}
              strokeWidth={sw(0.5)}
            />
          );
        })}
        <text
          x={ax - tickLen * 1.6}
          y={(y0 + y1) / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${ax - tickLen * 1.6} ${(y0 + y1) / 2})`}
          fill="var(--state-line)"
          fontSize={fs(6)}
          letterSpacing={fs(0.6)}
        >
          {`N–S  ${formatKm(m.heightKm)}`}
        </text>
      </g>

      {/* N-S extent line */}
      <line
        x1={north[0]}
        y1={north[1]}
        x2={south[0]}
        y2={south[1]}
        stroke="#ffffff"
        strokeOpacity={0.75}
        strokeWidth={sw(0.6)}
        strokeDasharray={dash(3, 2)}
        className="axis-dotted line-flicker"
      />
      {/* E-W extent line */}
      <line
        x1={west[0]}
        y1={west[1]}
        x2={east[0]}
        y2={east[1]}
        stroke="#ffffff"
        strokeOpacity={0.75}
        strokeWidth={sw(0.6)}
        strokeDasharray={dash(3, 2)}
        className="axis-dotted line-flicker"
        style={{ animationDelay: "300ms, 700ms" }}
      />

      {/* longest cross-country route */}
      <line
        x1={la[0]}
        y1={la[1]}
        x2={lb[0]}
        y2={lb[1]}
        stroke="var(--state-line)"
        strokeWidth={sw(1)}
        strokeDasharray={dash(5, 2.5)}
        className="axis-dotted"
        style={{ filter: "drop-shadow(0 0 3px var(--state-glow))" }}
      />
      {[la, lb, north, south, west, east].map((pt, i) => (
        <circle
          key={`node-${i}`}
          cx={pt[0]}
          cy={pt[1]}
          r={sw(1.4)}
          fill="var(--state-line)"
          className="line-flicker"
          style={{ animationDelay: `${i * 180}ms` }}
        />
      ))}
      <text
        x={(la[0] + lb[0]) / 2}
        y={(la[1] + lb[1]) / 2 - fs(3)}
        textAnchor="middle"
        fill="#ffffff"
        fontSize={fs(6)}
        letterSpacing={fs(0.5)}
      >
        {`LONGEST ROUTE  ${formatKm(m.longestKm)}`}
      </text>
    </g>
  );
}
