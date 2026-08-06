import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const TILE = 256;

export type Marker = {
  lat: number;
  lon: number;
  kind?: "target" | "you";
  radar?: boolean;
};

type Props = {
  lat: number;
  lon: number;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  markers?: Marker[];
  className?: string;
  /** draw place-name labels over the imagery */
  labels?: boolean;
};

const IMAGERY = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const REFERENCE = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`;

const lon2px = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z * TILE;
const lat2px = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z * TILE;
};
const px2lon = (px: number, z: number) => (px / (2 ** z * TILE)) * 360 - 180;
const px2lat = (px: number, z: number) => {
  const n = Math.PI - 2 * Math.PI * (px / (2 ** z * TILE));
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
};
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/**
 * Hand-driven satellite viewer: drag to pan, wheel / pinch to zoom.
 * No zoom buttons — the imagery is controlled entirely by hand.
 */
export function SatelliteCanvas({
  lat,
  lon,
  zoom = 8,
  minZoom = 3,
  maxZoom = 18,
  markers = [],
  className = "",
  labels = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 520 });
  const [view, setView] = useState({ lat, lon, z: zoom });
  const viewRef = useRef(view);
  viewRef.current = view;
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => setView({ lat, lon, z: zoom }), [lat, lon, zoom]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* wheel zoom anchored at the cursor (non-passive so the page never scrolls) */
  const onWheelRef = useRef<(e: WheelEvent) => void>(() => {});
  onWheelRef.current = (e: WheelEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
    const v = viewRef.current;
    const next = clamp(v.z - dy * 0.0025, minZoom, maxZoom);
    if (next === v.z) return;
    // keep the geo point under the cursor fixed
    const zi = v.z;
    const cx = lon2px(v.lon, zi);
    const cy = lat2px(v.lat, zi);
    const ax = cx + (px - size.w / 2);
    const ay = cy + (py - size.h / 2);
    const anchorLon = px2lon(ax, zi);
    const anchorLat = px2lat(ay, zi);
    const nax = lon2px(anchorLon, next);
    const nay = lat2px(anchorLat, next);
    setView({
      z: next,
      lon: px2lon(nax - (px - size.w / 2), next),
      lat: clamp(px2lat(nay - (py - size.h / 2), next), -85, 85),
    });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      onWheelRef.current(e);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  /* two-finger pinch zoom + one-finger drag */
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number; z: number } | null>(null);

  const zoomAt = useCallback(
    (px: number, py: number, next: number) => {
      const v = viewRef.current;
      const zi = v.z;
      const ax = lon2px(v.lon, zi) + (px - size.w / 2);
      const ay = lat2px(v.lat, zi) + (py - size.h / 2);
      const nax = lon2px(px2lon(ax, zi), next);
      const nay = lat2px(px2lat(ay, zi), next);
      setView({
        z: next,
        lon: px2lon(nax - (px - size.w / 2), next),
        lat: clamp(px2lat(nay - (py - size.h / 2), next), -85, 85),
      });
    },
    [size.w, size.h],
  );

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a!.x - b!.x, a!.y - b!.y),
        z: viewRef.current.z,
      };
      drag.current = null;
    } else {
      drag.current = { x: e.clientX, y: e.clientY };
    }
    setGrabbing(true);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (pointers.current.has(e.pointerId))
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.current.size >= 2 && pinch.current) {
        const [a, b] = [...pointers.current.values()];
        const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (dist > 0 && pinch.current.dist > 0) {
          const next = clamp(
            pinch.current.z + Math.log2(dist / pinch.current.dist),
            minZoom,
            maxZoom,
          );
          const el = ref.current;
          if (el) {
            const rect = el.getBoundingClientRect();
            zoomAt(
              (a!.x + b!.x) / 2 - rect.left,
              (a!.y + b!.y) / 2 - rect.top,
              next,
            );
          }
        }
        return;
      }

      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      drag.current = { x: e.clientX, y: e.clientY };
      setView((v) => {
        const cx = lon2px(v.lon, v.z) - dx;
        const cy = lat2px(v.lat, v.z) - dy;
        return { z: v.z, lon: px2lon(cx, v.z), lat: clamp(px2lat(cy, v.z), -85, 85) };
      });
    },
    [maxZoom, minZoom, zoomAt],
  );

  const endDrag = useCallback((e?: React.PointerEvent) => {
    if (e) pointers.current.delete(e.pointerId);
    else pointers.current.clear();
    if (pointers.current.size < 2) pinch.current = null;
    drag.current = null;
    setGrabbing(false);
  }, []);


  /* ---- tiles ---- */
  const zi = Math.max(0, Math.min(19, Math.round(view.z)));
  const scale = 2 ** (view.z - zi);
  const cx = lon2px(view.lon, zi);
  const cy = lat2px(view.lat, zi);
  const halfW = size.w / 2 / scale;
  const halfH = size.h / 2 / scale;
  const x0 = Math.floor((cx - halfW) / TILE);
  const x1 = Math.floor((cx + halfW) / TILE);
  const y0 = Math.floor((cy - halfH) / TILE);
  const y1 = Math.floor((cy + halfH) / TILE);
  const max = 2 ** zi;

  const tiles: { x: number; y: number; left: number; top: number }[] = [];
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) {
      if (y < 0 || y >= max) continue;
      tiles.push({
        x: ((x % max) + max) % max,
        y,
        left: (x * TILE - cx) * scale + size.w / 2,
        top: (y * TILE - cy) * scale + size.h / 2,
      });
    }

  const project = (mLat: number, mLon: number) => ({
    x: (lon2px(mLon, zi) - cx) * scale + size.w / 2,
    y: (lat2px(mLat, zi) - cy) * scale + size.h / 2,
  });

  const s = TILE * scale;

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      className={`relative overflow-hidden bg-black select-none ${
        grabbing ? "cursor-grabbing" : "cursor-grab"
      } ${className}`}
      style={{ touchAction: "none" }}
    >
      {tiles.map((t) => (
        <div
          key={`${zi}-${t.x}-${t.y}`}
          className="absolute"
          style={{ left: t.left, top: t.top, width: s, height: s }}
        >
          <img
            src={IMAGERY(zi, t.x, t.y)}
            alt=""
            draggable={false}
            className="h-full w-full object-cover"
          />
          {labels && (
            <img
              src={REFERENCE(zi, t.x, t.y)}
              alt=""
              draggable={false}
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80"
            />
          )}
        </div>
      ))}

      {/* markers: precision dots, never circles-only */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {markers.map((m, i) => {
          const p = project(m.lat, m.lon);
          const color = m.kind === "you" ? "#38bdf8" : "var(--focus-line)";
          return (
            <g key={`${m.lat}-${m.lon}-${i}`} transform={`translate(${p.x},${p.y})`}>
              {m.radar && (
                <>
                  <circle className="node-ping" r={70} fill="none" stroke={color} strokeWidth={1} />
                  <circle
                    className="node-ping"
                    r={70}
                    fill="none"
                    stroke={color}
                    strokeWidth={1}
                    style={{ animationDelay: "1.2s" }}
                  />
                </>
              )}
              <line x1={-14} x2={-5} stroke={color} strokeWidth={1} />
              <line x1={5} x2={14} stroke={color} strokeWidth={1} />
              <line y1={-14} y2={-5} stroke={color} strokeWidth={1} />
              <line y1={5} y2={14} stroke={color} strokeWidth={1} />
              <circle r={3.2} fill={color} style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
            </g>
          );
        })}
      </svg>

      <div className="mono-hud pointer-events-none absolute bottom-2 left-3 text-[9px] tracking-[0.2em] text-emerald-300/80">
        Z{view.z.toFixed(1)} · {view.lat.toFixed(4)}, {view.lon.toFixed(4)} · DRAG /
        WHEEL
      </div>
      <span className="pointer-events-none absolute bottom-2 right-3 text-[9px] text-white/40">
        Imagery © Esri
      </span>
    </div>
  );
}
