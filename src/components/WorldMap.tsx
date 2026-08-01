import { useMemo, useEffect, useState, useRef } from "react";
import { geoEquirectangular, geoPath, geoGraticule10 } from "d3-geo";
import { select } from "d3-selection";
import { zoom, type ZoomBehavior } from "d3-zoom";
import "d3-transition";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import worldData from "world-atlas/countries-110m.json";

type CountryProps = { name: string };

export function WorldMap() {
  const [size, setSize] = useState({ width: 1200, height: 620 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight || window.innerHeight;
      setSize({ width: w, height: h });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { countries, path, graticule, outline } = useMemo(() => {
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
      outline: p({ type: "Sphere" }) ?? "",
    };
  }, [size.width, size.height]);

  // Attach d3-zoom behavior to the svg; apply transform to the map group.
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    const g = gRef.current;
    if (!svg || !g) return;

    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 32])
      .on("zoom", (event) => {
        setTransform(event.transform);
      });
    zoomRef.current = z;

    select(svg).call(z);

    return () => {
      select(svg).on(".zoom", null);
    };
  }, []);

  // Reset zoom to default.
  const resetView = () => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current) return;
    select(svg).transition().duration(400).call(zoomRef.current.transform, {
      k: 1,
      x: 0,
      y: 0,
    } as never);
  };

  // Zoom in/out anchored at viewport center.
  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    if (!svg || !zoomRef.current) return;
    const cx = size.width / 2;
    const cy = size.height / 2;
    zoomRef.current.scaleBy(select(svg).transition().duration(200), factor, [
      cx,
      cy,
    ]);
  };

  return (
    <div ref={wrapRef} className="relative w-full h-full">
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="w-full h-full block"
        role="img"
        aria-label="World map of all countries"
        style={{ background: "#000", touchAction: "none" }}
      >
        <g ref={gRef} transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <path d={outline} className="fill-transparent" strokeWidth={0} />
          <path
            d={graticule}
            fill="none"
            className="stroke-zinc-500/30"
            strokeWidth={0.4}
          />
          <g>
            {countries.map((c, i) => (
              <path
                key={(c.id as string) ?? i}
                d={path(c) ?? ""}
                className={
                  hovered === c.properties?.name
                    ? "fill-white/20 stroke-white"
                    : "fill-transparent stroke-white/80"
                }
                strokeWidth={0.6}
                strokeLinejoin="round"
                onMouseEnter={() => setHovered(c.properties?.name ?? null)}
                onMouseLeave={() => setHovered(null)}
              />
            ))}
          </g>
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => zoomBy(1.6)}
          aria-label="Zoom in"
          className="h-10 w-10 grid place-items-center rounded-md border border-white/30 bg-black/60 text-white text-xl leading-none hover:bg-white/10 transition-colors"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / 1.6)}
          aria-label="Zoom out"
          className="h-10 w-10 grid place-items-center rounded-md border border-white/30 bg-black/60 text-white text-xl leading-none hover:bg-white/10 transition-colors"
        >
          −
        </button>
        <button
          type="button"
          onClick={resetView}
          aria-label="Reset view"
          className="h-10 w-10 grid place-items-center rounded-md border border-white/30 bg-black/60 text-white text-sm hover:bg-white/10 transition-colors"
        >
          ⤢
        </button>
      </div>
    </div>
  );
}
