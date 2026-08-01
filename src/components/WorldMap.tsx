import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoEquirectangular, geoPath, geoGraticule10 } from "d3-geo";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import "d3-transition";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldData from "world-atlas/countries-110m.json";
import admin1 from "@/data/admin1-top20.json";
import { TOUR } from "@/data/tour";

type CountryProps = { name: string };
type StateProps = { name: string | null };
type Phase = "fly" | "draw" | "hold" | "out";

const ADMIN1 = admin1 as unknown as Record<
  string,
  FeatureCollection<Geometry, StateProps>
>;

const TIMING = { fly: 1600, hold: 1500, out: 1400 } as const;

export function WorldMap() {
  const [size, setSize] = useState({ width: 1200, height: 620 });
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("fly");
  const [playing, setPlaying] = useState(true);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const stop = TOUR[index] ?? TOUR[0]!;

  /* ---------------- responsive sizing ---------------- */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () =>
      setSize({
        width: el.clientWidth,
        height: el.clientHeight || window.innerHeight,
      });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------------- geo setup ---------------- */
  const { countries, path, graticule } = useMemo(() => {
    const fc = feature(
      worldData as never,
      (worldData as never as { objects: { countries: unknown } }).objects
        .countries as never,
    ) as unknown as FeatureCollection<Geometry, CountryProps>;

    const projection = geoEquirectangular().fitExtent(
      [
        [0, 0],
        [size.width, size.height],
      ],
      { type: "Sphere" },
    );
    const p = geoPath(projection);
    return {
      countries: fc.features,
      path: p,
      graticule: p(geoGraticule10()) ?? "",
    };
  }, [size.width, size.height]);

  const countryByName = useMemo(() => {
    const m = new Map<string, Feature<Geometry, CountryProps>>();
    for (const c of countries) if (c.properties?.name) m.set(c.properties.name, c);
    return m;
  }, [countries]);

  /* ---------------- zoom behaviour ---------------- */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 64])
      .on("zoom", (event) => setTransform(event.transform));
    zoomRef.current = z;
    select(svg).call(z);
    return () => {
      select(svg).on(".zoom", null);
    };
  }, []);

  const flyTo = useCallback(
    (t: { k: number; x: number; y: number }, duration: number) => {
      const svg = svgRef.current;
      if (!svg || !zoomRef.current) return;
      select(svg)
        .transition()
        .duration(duration)
        .call(
          zoomRef.current.transform,
          zoomIdentity.translate(t.x, t.y).scale(t.k),
        );
    },
    [],
  );

  const targetFor = useCallback(
    (worldName: string) => {
      const f = countryByName.get(worldName);
      if (!f) return null;
      const [[x0, y0], [x1, y1]] = path.bounds(f);
      const w = Math.max(x1 - x0, 1);
      const h = Math.max(y1 - y0, 1);
      const k = Math.max(
        1,
        Math.min(48, 0.72 * Math.min(size.width / w, size.height / h)),
      );
      return {
        k,
        x: size.width / 2 - (k * (x0 + x1)) / 2,
        y: size.height / 2 - (k * (y0 + y1)) / 2,
      };
    },
    [countryByName, path, size.width, size.height],
  );

  /* ---------------- state (admin-1) borders for current stop ---------------- */
  const statePaths = useMemo(() => {
    const fc = ADMIN1[stop.admin1Key];
    if (!fc) return [] as { d: string; name: string | null }[];
    return fc.features
      .map((f) => ({ d: path(f) ?? "", name: f.properties?.name ?? null }))
      .filter((s) => s.d.length > 0);
  }, [stop.admin1Key, path]);

  const stagger = Math.min(70, 2200 / Math.max(statePaths.length, 1));
  const drawMs = 900 + stagger * statePaths.length;

  /* ---------------- the timeline ---------------- */
  useEffect(() => {
    if (!playing) return;
    let timer: ReturnType<typeof setTimeout>;

    if (phase === "fly") {
      const t = targetFor(stop.worldName);
      if (t) flyTo(t, TIMING.fly);
      timer = setTimeout(() => setPhase("draw"), TIMING.fly);
    } else if (phase === "draw") {
      timer = setTimeout(() => setPhase("hold"), drawMs);
    } else if (phase === "hold") {
      timer = setTimeout(() => setPhase("out"), TIMING.hold);
    } else {
      flyTo({ k: 1, x: 0, y: 0 }, TIMING.out);
      timer = setTimeout(() => {
        setIndex((i) => (i + 1) % TOUR.length);
        setPhase("fly");
      }, TIMING.out);
    }

    return () => clearTimeout(timer);
  }, [phase, index, playing, stop.worldName, targetFor, flyTo, drawMs]);

  const goTo = (i: number) => {
    setIndex((i + TOUR.length) % TOUR.length);
    setPhase("fly");
    setPlaying(true);
  };

  const showStates = phase === "draw" || phase === "hold";
  const showLabel = phase === "draw" || phase === "hold" || phase === "out";

  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="w-full h-full block"
        role="img"
        aria-label="Animated world map tour of the 20 largest countries"
        style={{ background: "#000", touchAction: "none" }}
      >
        <g
          transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}
        >
          <path
            d={graticule}
            fill="none"
            className="stroke-zinc-500/25"
            strokeWidth={0.4 / transform.k}
          />

          {countries.map((c, i) => {
            const active = c.properties?.name === stop.worldName;
            return (
              <path
                key={(c.id as string) ?? i}
                d={path(c) ?? ""}
                fill={active ? "rgba(255,255,255,0.06)" : "transparent"}
                className={active ? "stroke-white" : "stroke-white/70"}
                strokeWidth={(active ? 1.1 : 0.6) / transform.k}
                strokeLinejoin="round"
              />
            );
          })}

          {showStates && (
            <g key={`${index}-states`}>
              {statePaths.map((s, i) => (
                <path
                  key={`${s.name ?? i}-${i}`}
                  d={s.d}
                  className="state-path"
                  pathLength={1}
                  strokeWidth={0.9 / transform.k}
                  strokeDasharray={1}
                  style={{
                    animationDelay: `${i * stagger}ms`,
                    filter: "drop-shadow(0 0 2px var(--state-glow))",
                  }}
                />
              ))}
            </g>
          )}
        </g>
      </svg>

      {/* Country label */}
      {showLabel && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex flex-col items-center">
          <h1
            key={`${index}-${phase === "out" ? "out" : "in"}`}
            className={`${phase === "out" ? "label-out" : "label-in"} text-3xl md:text-5xl font-light uppercase text-foreground`}
          >
            {stop.label}
          </h1>
          <span
            className={`${phase === "out" ? "label-out" : "label-in"} mt-3 text-xs tracking-[0.4em] uppercase text-muted-foreground`}
          >
            {statePaths.length} states / provinces
          </span>
        </div>
      )}

      {/* Progress */}
      <div className="pointer-events-none absolute left-0 top-0 h-px w-full bg-white/10">
        <div
          className="h-px bg-white/70 transition-[width] duration-500"
          style={{ width: `${((index + 1) / TOUR.length) * 100}%` }}
        />
      </div>

      {/* Tour controls */}
      <div className="absolute inset-x-0 bottom-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          aria-label="Previous country"
          className="h-10 w-10 grid place-items-center rounded-full border border-white/25 bg-black/60 text-foreground hover:bg-white/10 transition-colors"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="h-10 px-5 rounded-full border border-white/25 bg-black/60 text-xs uppercase tracking-[0.3em] text-foreground hover:bg-white/10 transition-colors"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          aria-label="Next country"
          className="h-10 w-10 grid place-items-center rounded-full border border-white/25 bg-black/60 text-foreground hover:bg-white/10 transition-colors"
        >
          ›
        </button>
      </div>

      {/* Counter */}
      <div className="pointer-events-none absolute left-5 top-5 text-xs tracking-[0.35em] uppercase text-muted-foreground">
        {String(index + 1).padStart(2, "0")} / {TOUR.length}
      </div>
    </div>
  );
}
