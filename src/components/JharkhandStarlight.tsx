import { useCallback, useMemo, useState } from "react";
import { SatelliteCanvas, type Marker } from "@/components/SatelliteCanvas";
import { getBrowserFix, getIpInfo, type Fix } from "@/lib/geoTrace";

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

  const runTrace = useCallback(async () => {
    setTrace("tracing");
    try {
      const [ipRes, fixRes] = await Promise.allSettled([getIpInfo(), getBrowserFix()]);
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
            className="grid h-24 w-24 place-items-center rounded-full border border-emerald-400/70 bg-black/60 text-emerald-300 backdrop-blur transition-transform hover:scale-110 disabled:opacity-70"
          >
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.4}>
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
              <path d="M12 1v3M12 20v3M1 12h3M20 12h3" strokeLinecap="round" />
              {trace === "tracing" && (
                <circle cx="12" cy="12" r="8" className="pulse" opacity="0.5" />
              )}
            </svg>
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
