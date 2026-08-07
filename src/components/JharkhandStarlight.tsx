import { useCallback, useMemo, useState } from "react";
import { SatelliteCanvas, type Marker } from "@/components/SatelliteCanvas";
import {
  getBrowserFix,
  getIpInfo,
  reverseGeocode,
  type Fix,
  type IpInfo,
  type PlaceInfo,
} from "@/lib/geoTrace";


/** Whole-India frame: where the console always opens. */
const INDIA = { lat: 22.6, lon: 79.4, zoom: 4.4 };

type Props = {
  onClose: () => void;
  target?: { lat: number; lon: number } | undefined;
};

type TraceState = "idle" | "tracing" | "done" | "error";

/** Full-screen satellite console: India frame → trace button → radar zoom to live location. */
export function JharkhandStarlight({ onClose }: Props) {
  const [trace, setTrace] = useState<TraceState>("idle");
  const [fix, setFix] = useState<Fix | null>(null);
  const [ip, setIp] = useState<IpInfo | null>(null);
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const runTrace = useCallback(async () => {
    setTrace("tracing");
    try {
      const [ipRes, fixRes] = await Promise.allSettled([getIpInfo(), getBrowserFix()]);
      if (ipRes.status === "fulfilled") setIp(ipRes.value);
      const f =
        fixRes.status === "fulfilled"
          ? fixRes.value
          : ipRes.status === "fulfilled" &&
              ipRes.value.lat != null &&
              ipRes.value.lon != null
            ? ({
                lat: ipRes.value.lat,
                lon: ipRes.value.lon,
                accuracy: 5000,
                source: "ip",
              } satisfies Fix)
            : null;
      if (!f) throw new Error("no signal");
      // let the radar sweep run over India before the punch-in
      await new Promise((r) => setTimeout(r, 1400));
      setFix(f);
      setTrace("done");
      void reverseGeocode(f.lat, f.lon)
        .then(setPlace)
        .catch(() => undefined);
    } catch {
      setTrace("error");
    }
  }, []);


  const lock = useMemo(
    () => (fix ? { lat: fix.lat, lon: fix.lon, zoom: 17 } : INDIA),
    [fix],
  );

  const markers = useMemo<Marker[]>(
    () => (fix ? [{ lat: fix.lat, lon: fix.lon, kind: "you", radar: true }] : []),
    [fix],
  );

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div key={fix ? "locked" : "india"} className="zoom-punch h-full w-full">
        <SatelliteCanvas
          lat={lock.lat}
          lon={lock.lon}
          zoom={lock.zoom}
          markers={markers}
          className="h-full w-full"
        />
      </div>

      {/* radar sweep */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="relative h-[62vmin] w-[62vmin] rounded-full border border-emerald-400/25">
          <div className="absolute inset-[16%] rounded-full border border-emerald-400/20" />
          <div className="absolute inset-[34%] rounded-full border border-emerald-400/15" />
          <div
            className="radar-spin absolute inset-0 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg, rgba(52,211,153,0.28), rgba(52,211,153,0) 28%)",
            }}
          />
        </div>
      </div>

      {/* trace icon button — centre stage until a lock is acquired */}
      {trace !== "done" && (
        <div className="absolute inset-0 grid place-items-center">
          <button
            type="button"
            aria-label="Trace my location"
            onClick={() => void runTrace()}
            disabled={trace === "tracing"}
            className="group relative grid h-32 w-32 place-items-center rounded-full disabled:cursor-wait"
          >
            <span className="absolute inset-0 rounded-full bg-emerald-400/10 blur-xl transition-all group-hover:bg-emerald-400/25" />
            <span className="absolute inset-0 rounded-full border border-emerald-400/30 group-hover:border-emerald-400/60" />
            <span
              className={`absolute inset-2 rounded-full border border-emerald-400/50 ${
                trace === "tracing" ? "radar-spin" : ""
              }`}
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(52,211,153,0.30), rgba(52,211,153,0) 40%)",
              }}
            />
            <span className="relative grid h-20 w-20 place-items-center rounded-full border border-emerald-400/80 bg-black/70 text-emerald-300 backdrop-blur transition-transform duration-300 group-hover:scale-110 group-active:scale-95">
              <svg
                viewBox="0 0 24 24"
                className="h-9 w-9"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.3}
              >
                <circle cx="12" cy="12" r="8" opacity="0.7" />
                <circle cx="12" cy="12" r="4.4" opacity="0.5" />
                <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />
                <path d="M12 0.5v3.5M12 20v3.5M0.5 12H4M20 12h3.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className="mono-hud absolute -bottom-7 text-[10px] uppercase tracking-[0.35em] text-emerald-300/80">
              {trace === "tracing" ? "tracing" : trace === "error" ? "retry" : "trace"}
            </span>
          </button>
        </div>
      )}

      {/* small details chip once locked */}
      {trace === "done" && fix && (
        <div className="absolute bottom-5 left-5 flex flex-col items-start gap-2">
          {showDetails && (
            <div className="mono-hud trace-in w-64 rounded-md border border-emerald-400/30 bg-black/85 p-3 text-[11px] text-white/85 backdrop-blur">
              <D k="District" v={place?.district ?? "—"} />
              <D k="State" v={place?.state ?? "—"} />
              <D k="Place" v={place?.city ?? place?.village ?? place?.suburb ?? "—"} />
              <D k="Road" v={place?.road ?? "—"} />
              <D k="PIN" v={place?.postcode ?? "—"} />
              <D k="Coords" v={`${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)}`} />
              <D k="Accuracy" v={`±${Math.round(fix.accuracy)} m · ${fix.source}`} />
              <D k="IP" v={ip?.ip ?? "—"} />
              <D k="Network" v={ip?.org ?? "—"} />
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            className="mono-hud rounded-full border border-emerald-400/50 bg-black/70 px-3 py-1.5 text-[10px] uppercase tracking-[0.25em] text-emerald-300 backdrop-blur transition-colors hover:bg-emerald-400/15"
          >
            {showDetails ? "hide" : place?.district ?? "details"}
          </button>
        </div>
      )}


      <button
        type="button"
        aria-label="Close satellite console"
        onClick={onClose}
        className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-black/70 text-white hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function D({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-emerald-300/70">{k}</span>
      <span className="truncate text-right">{v}</span>
    </div>
  );
}
