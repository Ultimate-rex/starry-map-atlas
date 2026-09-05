import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SatelliteCanvas, type Marker } from "@/components/SatelliteCanvas";
import {
  getBrowserFix,
  getDeviceSnapshot,
  getIpInfo,
  reverseGeocode,
  type Fix,
  type IpInfo,
  type PlaceInfo,
} from "@/lib/geoTrace";
import { supabase } from "@/integrations/supabase/client";

/** Whole-India frame: where the console always opens. */
const INDIA = { lat: 22.6, lon: 79.4, zoom: 4.4 };

/** Cached trace, so repeat runs never re-ask and never drift. */
const STORE_KEY = "lv.trace.fix.v1";

type Cached = { fix: Fix; place: PlaceInfo | null; ip: IpInfo | null; ts: number };

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as Cached;
    return typeof c?.fix?.lat === "number" ? c : null;
  } catch {
    return null;
  }
}

function writeCache(c: Cached) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(c));
  } catch {
    /* storage unavailable */
  }
}

type Props = {
  onClose: () => void;
  target?: { lat: number; lon: number } | undefined;
};

type TraceState = "idle" | "tracing" | "done" | "error";
type SaveState = "idle" | "saving" | "saved" | "skipped" | "error";

/** Approach stages: continent → region → district → rooftop lock. */
const STAGE_ZOOM = [6, 9.5, 13] as const;
const STAGE_LABEL = ["sector sweep", "region narrowing", "district lock"] as const;
const STAGE_SHORT_LABEL = ["sector", "region", "district"] as const;
const STAGE_MS = 1500;

/** Full-screen satellite console: auto trace → staged radar zoom → exact lock. */
export function JharkhandStarlight({ onClose }: Props) {
  const [trace, setTrace] = useState<TraceState>("idle");
  const [fix, setFix] = useState<Fix | null>(null);
  const [ip, setIp] = useState<IpInfo | null>(null);
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  /** -1 = wide India frame, 0..2 = approach stages, 3 = final lock */
  const [stage, setStage] = useState(-1);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const started = useRef(false);

  const runTrace = useCallback(async () => {
    setTrace("tracing");
    setStage(-1);
    setSaveState("idle");
    try {
      const cached = readCache();
      let f: Fix | null = cached?.fix ?? null;
      if (cached) {
        setIp(cached.ip);
        setPlace(cached.place);
      }

      if (!f) {
        const [ipRes, fixRes] = await Promise.allSettled([
          getIpInfo(),
          getBrowserFix(),
        ]);
        const ipVal = ipRes.status === "fulfilled" ? ipRes.value : null;
        if (ipVal) setIp(ipVal);
        f =
          fixRes.status === "fulfilled"
            ? fixRes.value
            : ipVal && ipVal.lat != null && ipVal.lon != null
              ? ({
                  lat: ipVal.lat,
                  lon: ipVal.lon,
                  accuracy: 5000,
                  source: "ip",
                } satisfies Fix)
              : null;
        if (!f) throw new Error("no signal");

        const fixed = f;
        const p = await reverseGeocode(fixed.lat, fixed.lon).catch(() => null);
        if (p) setPlace(p);
        writeCache({ fix: fixed, place: p, ip: ipVal, ts: Date.now() });
      }

      setFix(f);
      // staged approach: three different framings, then the exact lock
      for (let s = 0; s < STAGE_ZOOM.length; s++) {
        setStage(s);
        await new Promise((r) => setTimeout(r, STAGE_MS));
      }
      await new Promise((r) => setTimeout(r, STAGE_MS));
      setStage(STAGE_ZOOM.length);
      setTrace("done");

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setSaveState("skipped");
        return;
      }
      setSaveState("saving");
      const snapshot = getDeviceSnapshot();
      const { error } = await supabase.from("location_traces").insert({
        user_id: userData.user.id,
        latitude: f.lat,
        longitude: f.lon,
        accuracy_m: f.accuracy,
        source: f.source,
        ip_address: ip?.ip ?? null,
        city: place?.city ?? place?.village ?? ip?.city ?? null,
        region: place?.state ?? ip?.region ?? null,
        country: place?.country ?? ip?.country ?? null,
        organization: ip?.org ?? null,
        timezone: ip?.timezone ?? snapshot.timezone,
        device_info: { ...snapshot, traceSavedAt: new Date().toISOString(), place: place?.displayName ?? null },
        consented_at: new Date().toISOString(),
      });
      setSaveState(error ? "error" : "saved");
    } catch {
      setTrace("error");
      setSaveState("error");
    }
  }, [ip, place]);

  /* trace starts by itself */
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void runTrace();
  }, [runTrace]);

  const lock = useMemo(() => {
    if (!fix || stage < 0) return INDIA;
    const z = stage >= STAGE_ZOOM.length ? 17 : STAGE_ZOOM[stage]!;
    return { lat: fix.lat, lon: fix.lon, zoom: z };
  }, [fix, stage]);

  const markers = useMemo<Marker[]>(
    () => (fix && stage >= 0 ? [{ lat: fix.lat, lon: fix.lon, kind: "you", radar: true }] : []),
    [fix, stage],
  );

  const statusText =
    trace === "error"
      ? "signal lost"
      : stage < 0
        ? "acquiring signal"
        : stage >= STAGE_ZOOM.length
          ? "target locked"
          : STAGE_LABEL[stage]!;
  const stageProgress = stage < 0 ? 0 : stage >= STAGE_ZOOM.length ? 100 : ((stage + 0.72) / STAGE_ZOOM.length) * 100;
  const currentStage = stage >= 0 && stage < STAGE_ZOOM.length ? STAGE_SHORT_LABEL[stage] : null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div key={`stage-${stage}`} className="zoom-punch h-full w-full">
        <SatelliteCanvas
          lat={lock.lat}
          lon={lock.lon}
          zoom={lock.zoom}
          markers={markers}
          className="h-full w-full"
        />
      </div>

      {trace === "tracing" && (
        <div className="absolute left-1/2 top-6 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 rounded-md border border-emerald-300/30 bg-black/70 px-4 py-3 text-emerald-100 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <span className="mono-hud text-[10px] uppercase tracking-[0.28em] text-emerald-200/70">Tracking sequence</span>
            <span className="mono-hud text-[10px] uppercase tracking-[0.2em] text-emerald-300">
              {stage < 0 ? "acquiring" : `${Math.min(stage + 1, STAGE_ZOOM.length)} / ${STAGE_ZOOM.length}`}
            </span>
          </div>
          <div className="mt-3 flex gap-1.5" aria-label="Trace progress">
            {STAGE_SHORT_LABEL.map((label, i) => (
              <div key={label} className="min-w-0 flex-1">
                <div className="h-1 overflow-hidden rounded-full bg-emerald-950/80">
                  <div className={`h-full rounded-full bg-emerald-300 transition-[width] duration-700 ${stage > i ? "w-full" : stage === i ? "w-2/3" : "w-0"}`} />
                </div>
                <p className={`mono-hud mt-1 truncate text-[9px] uppercase tracking-[0.16em] ${stage >= i ? "text-emerald-200" : "text-emerald-200/35"}`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-2 h-px overflow-hidden bg-emerald-950/80">
            <div className="h-full bg-emerald-300 transition-[width] duration-700" style={{ width: `${stageProgress}%` }} />
          </div>
          <p className="mono-hud mt-2 text-center text-[10px] uppercase tracking-[0.22em] text-emerald-200/70">
            {currentStage ? `${currentStage} lock in progress` : "requesting a location signal"}
          </p>
        </div>
      )}

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

      {/* centre "+" reticle — pulses through the approach, tappable to re-trace */}
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
            <span
              className={`absolute inset-2 rounded-full border border-emerald-400/50 ${
                trace === "tracing" ? "radar-spin" : ""
              }`}
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(52,211,153,0.30), rgba(52,211,153,0) 40%)",
              }}
            />
            <span className="relative grid h-20 w-20 place-items-center text-emerald-300">
              <svg
                viewBox="0 0 24 24"
                className="h-16 w-16"
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path d="M12 1v8M12 15v8M1 12h8M15 12h8" strokeLinecap="round" />
                <path d="M12 10.6v2.8M10.6 12h2.8" strokeLinecap="round" opacity="0.9" />
                <circle cx="12" cy="12" r="6.2" opacity="0.35" />
              </svg>
            </span>
            <span className="mono-hud absolute -bottom-7 whitespace-nowrap text-[10px] uppercase tracking-[0.35em] text-emerald-300/80">
              {statusText}
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
               <D k="Save" v={saveState === "saved" ? "saved to account" : saveState === "saving" ? "saving…" : saveState === "skipped" ? "sign in to save" : saveState === "error" ? "save failed" : "pending"} />
               <D k="Device" v={getDeviceLabel()} />
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

function getDeviceLabel() {
  try {
    const snapshot = getDeviceSnapshot();
    return `${snapshot.phoneModel} · ${snapshot.osVersion}`;
  } catch {
    return "—";
  }
}

function D({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-emerald-300/70">{k}</span>
      <span className="truncate text-right">{v}</span>
    </div>
  );
}
