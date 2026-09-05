import { useCallback, useEffect, useMemo, useState } from "react";
import { geoGraticule10, geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import indiaOutline from "@/data/india-outline.json";
import admin1 from "@/data/admin1-top20.json";
import type { Tables } from "@/integrations/supabase/types";
import { SatelliteCanvas } from "@/components/SatelliteCanvas";

export type TraceRecord = Tables<"location_traces">;

type Props = {
  records: TraceRecord[];
  selectedId: string | null;
  onSelect: (record: TraceRecord) => void;
};

const INDIA = indiaOutline as unknown as Feature<Geometry, { name: string }>;
const INDIA_STATES = admin1 as unknown as Record<string, FeatureCollection<Geometry, { name: string | null }>>;
const TILE = 256;

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
  const statePaths = useMemo(() => {
    const fc = INDIA_STATES.India;
    if (!fc) return [] as { d: string; name: string | null }[];
    return fc.features
      .map((f) => ({ d: path(f) ?? "", name: f.properties?.name ?? null }))
      .filter((state) => state.d.length > 0);
  }, [path]);

  const renderStates = useCallback(
    ({ width, height, zoom, center }: { width: number; height: number; zoom: number; center: { lat: number; lon: number } }) => {
      const scale = (2 ** zoom * TILE) / (2 * Math.PI);
      const centerLat = (center.lat * Math.PI) / 180;
      const centerLon = (center.lon * Math.PI) / 180;
      const projection = geoMercator()
        .scale(scale)
        .translate([
          width / 2 - scale * (centerLon + Math.PI),
          height / 2 + scale * Math.log(Math.tan(Math.PI / 4 + centerLat / 2)),
        ]);
      const statePath = geoPath(projection);
      return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`}>
          <path d={statePath(INDIA) ?? ""} fill="none" className="stroke-white/75" strokeWidth={1.2} />
          {statePaths.map((state, index) => {
            const feature = INDIA_STATES.India?.features[index];
            return feature ? (
              <path
                key={state.name ?? index}
                d={statePath(feature) ?? ""}
                fill="none"
                className="stroke-red-300/80"
                strokeWidth={0.9}
                strokeLinejoin="round"
              />
            ) : null;
          })}
        </svg>
      );
    },
    [statePaths],
  );

  return (
    <div id="admin-map-frame" className="relative min-h-[480px] w-full overflow-hidden bg-background">
      <SatelliteCanvas
        lat={22.6}
        lon={79.4}
        zoom={4.6}
        markers={records.map((record) => ({ lat: record.latitude, lon: record.longitude, kind: "target", radar: record.id === selectedId }))}
        renderOverlay={renderStates}
        labels
        className="min-h-[480px] w-full"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="pointer-events-none absolute bottom-3 left-3 border border-border/60 bg-background/85 px-3 py-2 backdrop-blur">
        <p className="mono-hud text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
          {records.length} saved target{records.length === 1 ? "" : "s"}
        </p>
        <p className="mono-hud mt-1 text-[10px] text-destructive">Red targets · real satellite · drag / pinch</p>
      </div>
    </div>
  );
}