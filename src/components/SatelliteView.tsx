import { useMemo, useState } from "react";

type Props = {
  lat: number;
  lon: number;
  /** grid radius in tiles */
  radius?: number;
  label?: string;
};

const TILE = 256;

function lon2tile(lon: number, z: number) {
  return ((lon + 180) / 360) * 2 ** z;
}
function lat2tile(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

const LAYERS = [
  {
    id: "imagery",
    name: "Satellite",
    url: (z: number, x: number, y: number) =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  },
  {
    id: "topo",
    name: "Terrain",
    url: (z: number, x: number, y: number) =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`,
  },
  {
    id: "hybrid",
    name: "Labels",
    url: (z: number, x: number, y: number) =>
      `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`,
  },
] as const;

/** Tiled satellite viewer (Esri World Imagery) centred on a coordinate. */
export function SatelliteView({ lat, lon, radius = 2, label }: Props) {
  const [z, setZ] = useState(12);
  const [layer, setLayer] = useState<(typeof LAYERS)[number]["id"]>("imagery");
  const active = LAYERS.find((l) => l.id === layer)!;
  const overlay = layer === "imagery";

  const tiles = useMemo(() => {
    const cx = Math.floor(lon2tile(lon, z));
    const cy = Math.floor(lat2tile(lat, z));
    const out: { x: number; y: number; key: string }[] = [];
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++)
        out.push({ x: cx + dx, y: cy + dy, key: `${z}-${cx + dx}-${cy + dy}` });
    return out;
  }, [lat, lon, z, radius]);

  const n = radius * 2 + 1;

  return (
    <div className="relative overflow-hidden rounded-lg border border-white/15 bg-black">
      <div
        className="grid w-full"
        style={{
          gridTemplateColumns: `repeat(${n}, minmax(0,1fr))`,
          aspectRatio: "1 / 1",
        }}
      >
        {tiles.map((t) => (
          <div key={t.key} className="relative bg-zinc-900">
            <img
              src={active.url(z, t.x, t.y)}
              width={TILE}
              height={TILE}
              loading="lazy"
              alt=""
              className="h-full w-full object-cover"
            />
            {overlay && (
              <img
                src={LAYERS[2].url(z, t.x, t.y)}
                width={TILE}
                height={TILE}
                loading="lazy"
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90"
              />
            )}
          </div>
        ))}
      </div>

      {/* crosshair on the centre */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="h-16 w-16 rounded-full border border-emerald-400/70 shadow-[0_0_20px_rgba(52,211,153,0.5)]" />
        <span className="absolute translate-y-14 mono-hud text-[10px] tracking-[0.3em] uppercase text-emerald-300">
          {label ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`}
        </span>
      </div>

      <div className="absolute left-3 top-3 flex gap-2">
        {LAYERS.slice(0, 2).map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLayer(l.id)}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition-colors ${
              layer === l.id
                ? "border-emerald-400/70 bg-emerald-400/15 text-emerald-300"
                : "border-white/20 bg-black/60 text-muted-foreground hover:bg-white/10"
            }`}
          >
            {l.name}
          </button>
        ))}
      </div>

      <div className="absolute right-3 top-3 flex items-center gap-2">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZ((v) => Math.max(6, v - 1))}
          className="h-8 w-8 rounded-full border border-white/20 bg-black/60 text-foreground hover:bg-white/10"
        >
          −
        </button>
        <span className="mono-hud text-[10px] tracking-[0.2em] text-muted-foreground">
          Z{z}
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZ((v) => Math.min(17, v + 1))}
          className="h-8 w-8 rounded-full border border-white/20 bg-black/60 text-foreground hover:bg-white/10"
        >
          +
        </button>
      </div>

      <span className="absolute bottom-2 right-3 text-[9px] text-muted-foreground">
        Imagery © Esri
      </span>
    </div>
  );
}
