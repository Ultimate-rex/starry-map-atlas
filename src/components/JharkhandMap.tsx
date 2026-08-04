import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import districts from "@/data/jharkhand-districts.json";
import { JH_DISTRICTS } from "@/data/jhInfo";

const FC = districts as unknown as FeatureCollection<Geometry, { name: string }>;

const W = 720;
const H = 620;

type Props = {
  highlight?: string;
  onSelect?: (name: string) => void;
};

/** Animated district-border map of Jharkhand. */
export function JharkhandMap({ highlight = "Lohardaga", onSelect }: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const paths = useMemo(() => {
    const projection = geoMercator().fitExtent(
      [
        [24, 24],
        [W - 24, H - 24],
      ],
      FC as never,
    );
    const p = geoPath(projection);
    return FC.features.map((f) => ({
      name: f.properties?.name ?? "",
      d: p(f) ?? "",
      c: p.centroid(f),
    }));
  }, []);

  const stat = JH_DISTRICTS.find((d) => d.name === (hover ?? highlight));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="District border map of Jharkhand"
      >
        <rect width={W} height={H} fill="#05070a" />
        {paths.map((p, i) => {
          const isHi = p.name === highlight;
          const isHover = p.name === hover;
          return (
            <path
              key={p.name}
              d={p.d}
              className="state-path cursor-pointer"
              pathLength={1}
              strokeDasharray={1}
              fill={
                isHi
                  ? "rgba(52,211,153,0.22)"
                  : isHover
                    ? "rgba(255,255,255,0.10)"
                    : "rgba(255,255,255,0.02)"
              }
              stroke={isHi ? "var(--focus-line)" : "rgba(255,255,255,0.75)"}
              strokeWidth={isHi ? 2 : 0.9}
              style={{
                animationDelay: `${i * 55}ms`,
                filter: isHi
                  ? "drop-shadow(0 0 6px var(--focus-glow))"
                  : "drop-shadow(0 0 2px var(--state-glow))",
              }}
              onMouseEnter={() => setHover(p.name)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(p.name)}
            />
          );
        })}
        {paths.map((p) => (
          <text
            key={`t-${p.name}`}
            x={p.c[0]}
            y={p.c[1]}
            textAnchor="middle"
            className="pointer-events-none mono-hud"
            fontSize={p.name === highlight ? 12 : 9}
            fill={p.name === highlight ? "var(--focus-line)" : "rgba(255,255,255,0.6)"}
          >
            {p.name}
          </text>
        ))}
      </svg>

      {stat && (
        <div className="mono-hud absolute right-3 top-3 w-56 rounded-md border border-white/15 bg-black/80 p-3 text-[11px]">
          <div className="mb-2 text-xs uppercase tracking-[0.25em] text-emerald-300">
            {stat.name}
          </div>
          <Row k="HQ" v={stat.hq} />
          <Row k="Area" v={`${stat.areaKm2.toLocaleString("en-IN")} km²`} />
          <Row k="Pop 2011" v={stat.population2011.toLocaleString("en-IN")} />
          <Row k="Literacy" v={`${stat.literacy}%`} />
          <Row k="Blocks" v={String(stat.blocks)} />
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right text-foreground">{v}</span>
    </div>
  );
}
