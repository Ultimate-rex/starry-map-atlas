import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { geoEquirectangular, geoPath, geoGraticule10 } from "d3-geo";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import "d3-transition";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldData from "world-atlas/countries-110m.json";
import admin1 from "@/data/admin1-top20.json";
import indiaOutline from "@/data/india-outline.json";
import jhDistricts from "@/data/jharkhand-districts.json";
import { TOUR } from "@/data/tour";
import { computeMetrics } from "@/lib/geoMetrics";
import { MeasureLayer } from "@/components/MeasureLayer";
import { MetricsHud } from "@/components/MetricsHud";
import { JharkhandStarlight } from "@/components/JharkhandStarlight";

type CountryProps = { name: string };
type StateProps = { name: string | null };
type Phase = "fly" | "draw" | "hold" | "out";

const ADMIN1 = admin1 as unknown as Record<
  string,
  FeatureCollection<Geometry, StateProps>
>;

/** Official India national outline (includes J&K and Ladakh in full). */
const INDIA = indiaOutline as unknown as Feature<Geometry, CountryProps>;

const JH = jhDistricts as unknown as FeatureCollection<Geometry, StateProps>;

/** world-atlas name -> admin1-top20 key */
const ADMIN1_ALIAS: Record<string, string> = {
  "Dem. Rep. Congo": "Democratic Republic of the Congo",
};

/**
 * Countries whose projected bounds are useless (they cross the antimeridian,
 * or have far-flung territories). Zoom uses this lon/lat box instead.
 */
const BBOX_OVERRIDE: Record<string, [number, number, number, number]> = {
  Russia: [28, 41, 179.5, 78],
  "United States of America": [-125, 24, -66.5, 49.5],
  France: [-5.2, 41.3, 9.6, 51.1],
  Norway: [4.5, 57.9, 31.2, 71.2],
  "New Zealand": [166, -47.4, 178.6, -34.3],
  Fiji: [177, -19.2, 180, -16],
  Kiribati: [-160, -3, -150, 4],
  Netherlands: [3.3, 50.7, 7.3, 53.6],
  Denmark: [8, 54.5, 15.2, 57.8],
  Chile: [-75.7, -55.9, -66.4, -17.5],
  Ecuador: [-81.1, -5.1, -75.2, 1.5],
  Portugal: [-9.6, 36.9, -6.1, 42.2],
  Spain: [-9.4, 36, 3.4, 43.8],
};

const TIMING = { fly: 1600, hold: 1500, out: 1400 } as const;

const GREEN = "var(--focus-line)";
const GREEN_GLOW = "var(--focus-glow)";


export function WorldMap() {
  const [size, setSize] = useState({ width: 1200, height: 620 });
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("fly");
  const [playing, setPlaying] = useState(true);
  const [focusName, setFocusName] = useState<string | null>(null);
  const [starlight, setStarlight] = useState<{ lat: number; lon: number } | null>(
    null,
  );


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

  /* ---------------- geo setup (perfectly flat, edge-to-edge) ---------------- */
  const { countries, path, projection, graticule } = useMemo(() => {
    const fc = feature(
      worldData as never,
      (worldData as never as { objects: { countries: unknown } }).objects
        .countries as never,
    ) as unknown as FeatureCollection<Geometry, CountryProps>;

    // Plate carrée: independent x/y scaling so the map is a flat rectangle
    // that fills the viewport with zero tilt or letterboxing.
    const projection = geoEquirectangular()
      .scale(size.width / (2 * Math.PI))
      .translate([size.width / 2, size.height / 2])
      .precision(0.1);

    const p = geoPath(projection);
    return {
      countries: fc.features,
      path: p,
      projection,
      graticule: p(geoGraticule10()) ?? "",
    };
  }, [size.width, size.height]);

  const countryByName = useMemo(() => {
    const m = new Map<string, Feature<Geometry, CountryProps>>();
    for (const c of countries) if (c.properties?.name) m.set(c.properties.name, c);
    // Use the official Indian national boundary (full J&K + Ladakh extent).
    m.set("India", INDIA);
    return m;
  }, [countries]);

  /** Countries drawn on the base layer, with India swapped for the official outline. */
  const drawnCountries = useMemo(
    () => countries.map((c) => (c.properties?.name === "India" ? INDIA : c)),
    [countries],
  );

  /** Jharkhand district borders, drawn when India is the active country. */
  const jhPaths = useMemo(
    () =>
      JH.features
        .map((f) => ({ d: path(f) ?? "", name: f.properties?.name ?? null }))
        .filter((s) => s.d.length > 0),
    [path],
  );


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
      const box = BBOX_OVERRIDE[worldName];
      let x0: number, y0: number, x1: number, y1: number;

      if (box) {
        const a = projection([box[0], box[3]]);
        const b = projection([box[2], box[1]]);
        if (!a || !b) return null;
        [x0, y0] = a;
        [x1, y1] = b;
      } else {
        const f = countryByName.get(worldName);
        if (!f) return null;
        const bounds = path.bounds(f);
        [[x0, y0], [x1, y1]] = bounds;
      }

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
    [countryByName, path, projection, size.width, size.height],
  );


  /* ---------------- focused (clicked) country ---------------- */
  const focusFeature = focusName ? (countryByName.get(focusName) ?? null) : null;

  const focusStatePaths = useMemo(() => {
    if (!focusName) return [] as { d: string; name: string | null }[];
    const key = ADMIN1_ALIAS[focusName] ?? focusName;
    const fc = ADMIN1[key];
    if (!fc) return [];
    return fc.features
      .map((f) => ({ d: path(f) ?? "", name: f.properties?.name ?? null }))
      .filter((s) => s.d.length > 0);
  }, [focusName, path]);

  const focusMetrics = useMemo(
    () => (focusFeature ? computeMetrics(focusFeature) : null),
    [focusFeature],
  );

  const focusCentroid = useMemo(
    () => (focusFeature ? path.centroid(focusFeature) : null),
    [focusFeature, path],
  );

  const handleCountryClick = useCallback(
    (name: string) => {
      if (focusName === name) {
        // second click on the same country -> zoom out and resume the loop
        setFocusName(null);
        flyTo({ k: 1, x: 0, y: 0 }, TIMING.out);
        setPhase("fly");
        setPlaying(true);
        return;
      }
      setFocusName(name);
      setPlaying(false);
      const t = targetFor(name);
      if (t) flyTo(t, TIMING.fly);
    },
    [focusName, flyTo, targetFor],
  );

  /** Convert a click on the map into geographic coordinates and lock the radar there. */
  const lockRadarAt = useCallback(
    (e: React.MouseEvent<SVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const sx = ((e.clientX - rect.left) / rect.width) * size.width;
      const sy = ((e.clientY - rect.top) / rect.height) * size.height;
      const gx = (sx - transform.x) / transform.k;
      const gy = (sy - transform.y) / transform.k;
      const inv = projection.invert?.([gx, gy]);
      if (!inv) return;
      setStarlight({ lon: inv[0], lat: inv[1] });
    },
    [projection, size.height, size.width, transform.k, transform.x, transform.y],
  );



  /* ---------------- state (admin-1) borders for current stop ---------------- */
  const statePaths = useMemo(() => {
    const fc = ADMIN1[stop.admin1Key];
    if (!fc) return [] as { d: string; name: string | null }[];
    return fc.features
      .map((f) => ({ d: path(f) ?? "", name: f.properties?.name ?? null }))
      .filter((s) => s.d.length > 0);
  }, [stop.admin1Key, path]);

  /* ---------------- measured geometry for the focused country ---------------- */
  const activeFeature = countryByName.get(stop.worldName) ?? null;
  const metrics = useMemo(
    () => (activeFeature ? computeMetrics(activeFeature) : null),
    [activeFeature],
  );

  const stagger = Math.min(70, 2200 / Math.max(statePaths.length, 1));
  const drawMs = 900 + stagger * statePaths.length;
  const focusStagger = Math.min(70, 2200 / Math.max(focusStatePaths.length, 1));

  /* ---------------- the timeline ---------------- */
  useEffect(() => {
    if (!playing || focusName) return;
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
  }, [phase, index, playing, focusName, stop.worldName, targetFor, flyTo, drawMs]);

  const goTo = (i: number) => {
    setFocusName(null);
    setIndex((i + TOUR.length) % TOUR.length);
    setPhase("fly");
    setPlaying(true);
  };

  const tourActive = !focusName;
  const showStates = tourActive && (phase === "draw" || phase === "hold");
  const showLabel =
    tourActive && (phase === "draw" || phase === "hold" || phase === "out");

  return (
    <div ref={wrapRef} className="relative w-full h-full overflow-hidden">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="w-full h-full block"
        role="img"
        aria-label="Animated flat world map tour of the 20 largest countries"
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

          {drawnCountries.map((c, i) => {
            const name = c.properties?.name;
            const active = !focusName && name === stop.worldName;
            const focused = name === focusName;
            return (
              <path
                key={(c.id as string) ?? name ?? i}
                d={path(c) ?? ""}
                fill={
                  focused
                    ? "rgba(52,211,153,0.08)"
                    : active
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(255,255,255,0.012)"
                }
                stroke={focused ? GREEN : undefined}
                className={
                  focused
                    ? "cursor-pointer"
                    : active
                      ? "stroke-white cursor-pointer"
                      : "stroke-white/45 cursor-pointer"
                }
                strokeWidth={(focused ? 1.6 : active ? 1.3 : 0.75) / transform.k}
                strokeLinejoin="round"
                strokeLinecap="round"
                onClick={(e) => {
                  if (!name) return;
                  // India already focused: a click targets the radar at that spot
                  if (name === "India" && focusName === "India") lockRadarAt(e);
                  else handleCountryClick(name);
                }}

                style={
                  focused
                    ? { filter: `drop-shadow(0 0 4px ${GREEN_GLOW})` }
                    : undefined
                }
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

          {/* Jharkhand district borders, drawn whenever India is on screen */}
          {(focusName === "India" ||
            (showStates && stop.worldName === "India")) && (
            <g key="jh-districts" onClick={lockRadarAt} className="cursor-pointer">
              {jhPaths.map((s, i) => (
                <path
                  key={`jh-${s.name ?? i}`}
                  d={s.d}
                  className="state-path state-path-focus"
                  pathLength={1}
                  strokeDasharray={1}
                  strokeWidth={0.5 / transform.k}
                  fill="rgba(52,211,153,0.05)"
                  style={{
                    animationDelay: `${600 + i * 40}ms`,
                    filter: `drop-shadow(0 0 2px ${GREEN_GLOW})`,
                  }}
                />
              ))}
            </g>
          )}



          {showStates && activeFeature && (
            <MeasureLayer
              feature={activeFeature}
              projection={projection}
              k={transform.k}
              runKey={`${index}-measure`}
            />
          )}

          {/* clicked country: green state borders + slow orbit sweep */}
          {focusFeature && focusCentroid && (
            <g
              key={`focus-${focusName}`}
              className="focus-spin"
              style={{
                transformOrigin: `${focusCentroid[0]}px ${focusCentroid[1]}px`,
              }}
              pointerEvents="none"
            >
              {focusStatePaths.map((s, i) => (
                <path
                  key={`f-${s.name ?? i}-${i}`}
                  d={s.d}
                  className="state-path state-path-focus"
                  pathLength={1}
                  strokeWidth={1 / transform.k}
                  strokeDasharray={1}
                  style={{
                    animationDelay: `${i * focusStagger}ms`,
                    filter: `drop-shadow(0 0 3px ${GREEN_GLOW})`,
                  }}
                />
              ))}
              <MeasureLayer
                feature={focusFeature}
                projection={projection}
                k={transform.k}
                runKey={`focus-${focusName}-measure`}
                color={GREEN}
                glow={GREEN_GLOW}
              />
            </g>
          )}
        </g>
      </svg>

      {/* Measurement read-out */}
      {showStates && metrics && (
        <MetricsHud
          label={stop.label}
          metrics={metrics}
          states={statePaths.length}
          runKey={index}
        />
      )}

      {focusMetrics && focusName && (
        <MetricsHud
          label={focusName}
          metrics={focusMetrics}
          states={focusStatePaths.length}
          runKey={focusName}
          accent="focus"
        />
      )}

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

      {focusName && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex flex-col items-center">
          <h1
            key={`focus-${focusName}`}
            className="label-in text-3xl md:text-5xl font-light uppercase"
            style={{ color: "var(--focus-line)" }}
          >
            {focusName}
          </h1>
          <span className="label-in mt-3 text-xs tracking-[0.4em] uppercase text-muted-foreground">
            locked — click again to zoom out
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
          onClick={() => {
            if (focusName) {
              setFocusName(null);
              flyTo({ k: 1, x: 0, y: 0 }, TIMING.out);
              setPhase("fly");
              setPlaying(true);
              return;
            }
            setPlaying((p) => !p);
          }}
          className="h-10 px-5 rounded-full border border-white/25 bg-black/60 text-xs uppercase tracking-[0.3em] text-foreground hover:bg-white/10 transition-colors"
        >
          {focusName ? "Release" : playing ? "Pause" : "Play"}
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

      {starlight && <JharkhandStarlight onClose={() => setStarlight(false)} />}

      {/* Counter */}
      <div className="pointer-events-none absolute left-5 top-5 text-xs tracking-[0.35em] uppercase text-muted-foreground">
        {String(index + 1).padStart(2, "0")} / {TOUR.length}
      </div>
    </div>
  );
}
