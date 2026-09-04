import { useEffect, useMemo, useState } from "react";
import { geoGraticule10, geoMercator, geoPath } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import indiaOutline from "@/data/india-outline.json";
import type { Tables } from "@/integrations/supabase/types";

export type TraceRecord = Tables<"location_traces">;

type Props = {
  records: TraceRecord[];
  selectedId: string | null;
  onSelect: (record: TraceRecord) => void;
};

const INDIA = indiaOutline as unknown as Feature<Geometry, { name: string }>;

export function AdminMap({ records, selectedId, onSelect }: Props) {
  const [size, setSize] = useState({ width: 960, height: 650 });

  useEffect(() => {
    const element = document.getElementById("admin-map-frame");
    if (!element) return;
    const update = () => {
      const width = Math.max(element.clientWidth, 320);
      setSize({ width, height: Math.max(480, Math.min(720, width * 0.68)) });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const projection = useMemo(
    () =>
      geoMercator().fitExtent(
        [
          [34, 30],
          [size.width - 34, size.height - 30],
        ],
        INDIA,
      ),
    [size.height, size.width],
  );
  const path = useMemo(() => geoPath(projection), [projection]);
  const graticule = useMemo(() => path(geoGraticule10()) ?? "", [path]);
  const selected = records.find((record) => record.id === selectedId) ?? null;
  const transform = selected
    ? (() => {
        const point = projection([selected.longitude, selected.latitude]);
        if (!point) return "";
        const scale = 3.2;
        return `translate(${size.width / 2 - point[0] * scale} ${size.height / 2 - point[1] * scale}) scale(${scale})`;
      })()
    : "";

  return (
    <div id="admin-map-frame" className="relative min-h-[480px] w-full overflow-hidden bg-background">
      <svg
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="block h-auto min-h-[480px] w-full"
        role="img"
        aria-label="India map with saved location targets"
      >
        <path d={graticule} fill="none" className="stroke-border/40" strokeWidth={0.5} />
        <g className="transition-transform duration-700 ease-out" transform={transform}>
          <path d={path(INDIA) ?? ""} className="fill-primary/5 stroke-foreground/70" strokeWidth={1.2} />
          {records.map((record) => {
            const point = projection([record.longitude, record.latitude]);
            if (!point) return null;
            const selectedRecord = record.id === selectedId;
            return (
              <g
                key={record.id}
                transform={`translate(${point[0]} ${point[1]})`}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label={`Open saved location from ${new Date(record.created_at).toLocaleString()}`}
                onClick={() => onSelect(record)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") onSelect(record);
                }}
              >
                <circle r={selectedRecord ? 13 : 9} className="admin-target-ping" fill="none" />
                <path d="M0 -10V10M-10 0H10" className="stroke-destructive" strokeWidth={selectedRecord ? 1.6 : 1.1} />
                <circle r={selectedRecord ? 3.5 : 2.5} className="fill-destructive" />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="pointer-events-none absolute bottom-3 left-3 border border-border/60 bg-background/85 px-3 py-2 backdrop-blur">
        <p className="mono-hud text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          {records.length} saved target{records.length === 1 ? "" : "s"}
        </p>
        <p className="mono-hud mt-1 text-[10px] text-destructive">Red targets · click to zoom</p>
      </div>
    </div>
  );
}