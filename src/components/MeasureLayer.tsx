import { useMemo } from "react";
import type { GeoProjection } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { computeMetrics, formatKm, type Pt } from "@/lib/geoMetrics";

type Props = {
  feature: Feature<Geometry, unknown>;
  projection: GeoProjection;
  k: number;
  runKey: string | number;
  /** Accent colour for the instrument lines. */
  color?: string;
  glow?: string;
};

const TICKS = 20;
const GRID = 8;

/**
 * Dotted X/Y measurement grid drawn over the focused country:
 * bounding box, tick axes, inner lattice, diagonals, corner brackets,
 * N-S and E-W extent lines, and the longest cross-country route.
 */
export function MeasureLayer({
  feature,
  projection,
  k,
  runKey,
  color = "var(--state-line)",
  glow = "var(--state-glow)",
}: Props) {
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
  const brace = Math.min(w, h) * 0.12;

  const lon = (i: number) => minLon + ((maxLon - minLon) * i) / GRID;
  const lat = (i: number) => minLat + ((maxLat - minLat) * i) / GRID;

  return (
    <g key={runKey} pointerEvents="none">
      {/* inner measurement lattice */}
      <g className="grid-fade">
        {Array.from({ length: GRID - 1 }, (_, i) => {
          const gx = x0 + (w * (i + 1)) / GRID;
          const gy = y0 + (h * (i + 1)) / GRID;
          return (
            <g key={`g-${i}`}>
              <line
                x1={gx}
                y1={y0}
                x2={gx}
                y2={y1}
                stroke={color}
                strokeOpacity={0.22}
                strokeWidth={sw(0.4)}
                strokeDasharray={dash(0.8, 2.4)}
                className="axis-dotted"
              />
              <line
                x1={x0}
                y1={gy}
                x2={x1}
                y2={gy}
                stroke={color}
                strokeOpacity={0.22}
                strokeWidth={sw(0.4)}
                strokeDasharray={dash(0.8, 2.4)}
                className="axis-dotted"
              />
              <text
                x={gx}
                y={y0 - fs(1.6)}
                textAnchor="middle"
                fill={color}
                fillOpacity={0.55}
                fontSize={fs(2.6)}
                letterSpacing={fs(0.2)}
              >
                {`${lon(i + 1).toFixed(1)}°`}
              </text>
              <text
                x={x1 + fs(1.6)}
                y={gy}
                dominantBaseline="middle"
                fill={color}
                fillOpacity={0.55}
                fontSize={fs(2.6)}
                letterSpacing={fs(0.2)}
              >
                {`${lat(GRID - i - 1).toFixed(1)}°`}
              </text>
            </g>
          );
        })}
      </g>

      {/* diagonals */}
      <line
        x1={x0}
        y1={y0}
        x2={x1}
        y2={y1}
        stroke={color}
        strokeOpacity={0.3}
        strokeWidth={sw(0.4)}
        strokeDasharray={dash(2, 3)}
        className="axis-dotted"
      />
      <line
        x1={x1}
        y1={y0}
        x2={x0}
        y2={y1}
        stroke={color}
        strokeOpacity={0.3}
        strokeWidth={sw(0.4)}
        strokeDasharray={dash(2, 3)}
        className="axis-dotted"
      />

      {/* dotted bounding box */}
      <rect
        x={x0}
        y={y0}
        width={w}
        height={h}
        fill="none"
        stroke={color}
        strokeOpacity={0.5}
        strokeWidth={sw(0.6)}
        strokeDasharray={dash(1.5, 3)}
        className="axis-dotted"
      />

      {/* corner brackets */}
      {[
        [x0, y0, 1, 1],
        [x1, y0, -1, 1],
        [x0, y1, 1, -1],
        [x1, y1, -1, -1],
      ].map(([bx, by, sx, sy], i) => (
        <path
          key={`br-${i}`}
          d={`M ${bx! + sx! * brace} ${by} L ${bx} ${by} L ${bx} ${by! + sy! * brace}`}
          fill="none"
          stroke={color}
          strokeWidth={sw(1.1)}
          className="bracket-in"
          style={{ animationDelay: `${i * 120}ms`, filter: `drop-shadow(0 0 3px ${glow})` }}
        />
      ))}

      {/* X axis */}
      <g className="axis-grow-x" style={{ transformOrigin: `${x0}px ${ay}px` }}>
        <line
          x1={x0}
          y1={ay}
          x2={x1}
          y2={ay}
          stroke={color}
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
              stroke={color}
              strokeOpacity={major ? 0.9 : 0.5}
              strokeWidth={sw(0.5)}
            />
          );
        })}
        <text
          x={(x0 + x1) / 2}
          y={ay + tickLen * 2.6}
          textAnchor="middle"
          fill={color}
          fontSize={fs(6)}
          letterSpacing={fs(0.6)}
          className="mono-hud"
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
          stroke={color}
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
              stroke={color}
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
          fill={color}
          fontSize={fs(6)}
          letterSpacing={fs(0.6)}
          className="mono-hud"
        >
          {`N–S  ${formatKm(m.heightKm)}`}
        </text>
      </g>

      {/* scanning sweep line */}
      <line
        x1={x0}
        y1={y0}
        x2={x1}
        y2={y0}
        stroke={color}
        strokeOpacity={0.7}
        strokeWidth={sw(0.8)}
        className="scan-sweep"
        style={{
          transformOrigin: `${x0}px ${y0}px`,
          ["--scan-h" as string]: `${h}px`,
          filter: `drop-shadow(0 0 4px ${glow})`,
        }}
      />

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
        stroke={color}
        strokeWidth={sw(1)}
        strokeDasharray={dash(5, 2.5)}
        className="axis-dotted"
        style={{ filter: `drop-shadow(0 0 3px ${glow})` }}
      />
      {[la, lb, north, south, west, east].map((pt, i) => (
        <g key={`node-${i}`}>
          <circle
            cx={pt[0]}
            cy={pt[1]}
            r={sw(1.4)}
            fill={color}
            className="line-flicker"
            style={{ animationDelay: `${i * 180}ms` }}
          />
          <circle
            cx={pt[0]}
            cy={pt[1]}
            r={sw(4)}
            fill="none"
            stroke={color}
            strokeOpacity={0.6}
            strokeWidth={sw(0.4)}
            className="node-ping"
            style={{ animationDelay: `${i * 220}ms` }}
          />
        </g>
      ))}
      <text
        x={(la[0] + lb[0]) / 2}
        y={(la[1] + lb[1]) / 2 - fs(3)}
        textAnchor="middle"
        fill="#ffffff"
        fontSize={fs(6)}
        letterSpacing={fs(0.5)}
        className="mono-hud"
      >
        {`LONGEST ROUTE  ${formatKm(m.longestKm)}`}
      </text>
    </g>
  );
}
