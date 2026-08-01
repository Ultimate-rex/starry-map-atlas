import { useMemo, useEffect, useState, useRef } from "react";
import { geoNaturalEarth1, geoPath, geoGraticule10 } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import worldData from "world-atlas/countries-110m.json";

type CountryProps = { name: string };

export function WorldMap() {
  const [size, setSize] = useState({ width: 1200, height: 620 });
  const [hovered, setHovered] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      setSize({ width: w, height: Math.round(w * 0.52) });
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

    const projection = geoNaturalEarth1().fitExtent(
      [
        [12, 12],
        [size.width - 12, size.height - 12],
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

  return (
    <div ref={wrapRef} className="w-full">
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="w-full h-auto"
        role="img"
        aria-label="World map of all countries"
      >
        <path d={outline} className="fill-transparent" strokeWidth={0} />
        <path
          d={graticule}
          fill="none"
          className="stroke-muted-foreground/25"
          strokeWidth={0.4}
        />
        <g>
          {countries.map((c, i) => (
            <path
              key={(c.id as string) ?? i}
              d={path(c) ?? ""}
              className={
                hovered === c.properties?.name
                  ? "fill-foreground/15 stroke-foreground"
                  : "fill-transparent stroke-foreground/80"
              }
              strokeWidth={0.6}
              strokeLinejoin="round"
              onMouseEnter={() => setHovered(c.properties?.name ?? null)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
