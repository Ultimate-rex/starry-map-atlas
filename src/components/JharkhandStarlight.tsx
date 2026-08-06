import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SatelliteCanvas, type Marker } from "@/components/SatelliteCanvas";
import {
  getBrowserFix,
  getIpInfo,
  nearestStreetImage,
  reverseGeocode,
  satelliteStills,
  type Fix,
  type IpInfo,
  type PlaceInfo,
} from "@/lib/geoTrace";

/** Whole-India frame: the trace always starts from the national view. */
const INDIA = { lat: 22.6, lon: 79.4, zoom: 4.2 };

type Props = { onClose: () => void };

type TraceState = "idle" | "tracing" | "done" | "error";

/** Full-screen satellite / radar console: India view → live current-location lock. */
export function JharkhandStarlight({ onClose }: Props) {
  const [trace, setTrace] = useState<TraceState>("idle");
  const [fix, setFix] = useState<Fix | null>(null);
  const [place, setPlace] = useState<PlaceInfo | null>(null);
  const [ip, setIp] = useState<IpInfo | null>(null);
  const [street, setStreet] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [heard, setHeard] = useState("");
  const [clock, setClock] = useState("");


  const push = useCallback(
    (line: string) => setLog((l) => [...l.slice(-7), line]),
    [],
  );

  useEffect(() => {
    const t = setInterval(
      () => setClock(new Date().toUTCString().slice(17, 25) + " UTC"),
      1000,
    );
    return () => clearInterval(t);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!voiceOn || typeof window === "undefined" || !window.speechSynthesis) return;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      window.speechSynthesis.speak(u);
    },
    [voiceOn],
  );

  const runTrace = useCallback(async () => {
    setTrace("tracing");
    setErr(null);
    push("> initialising radar sweep…");
    try {
      const [ipRes, fixRes] = await Promise.allSettled([getIpInfo(), getBrowserFix()]);
      if (ipRes.status === "fulfilled") {
        setIp(ipRes.value);
        push(`> network node ${ipRes.value.ip} · ${ipRes.value.city ?? "?"}`);
      }
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
      if (!f) throw new Error("No location signal available");
      setFix(f);
      push(`> lock ${f.lat.toFixed(5)}, ${f.lon.toFixed(5)} ±${Math.round(f.accuracy)}m`);
      const [p, img] = await Promise.allSettled([
        reverseGeocode(f.lat, f.lon),
        nearestStreetImage(f.lat, f.lon),
      ]);
      if (p.status === "fulfilled") {
        setPlace(p.value);
        push(`> ${p.value.displayName.slice(0, 64)}`);
        speak(`Location traced. ${p.value.displayName}`);
      }
      if (img.status === "fulfilled") setStreet(img.value);
      setTrace("done");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Trace failed");
      setTrace("error");
      push("> trace failed");
    }
  }, [push, speak]);

  /* voice command channel */
  const recRef = useRef<{ start: () => void; stop: () => void } | null>(null);
  const toggleVoice = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => never;
      webkitSpeechRecognition?: new () => never;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setErr("Voice input is not supported in this browser");
      return;
    }
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor() as unknown as {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
      onend: () => void;
      start: () => void;
      stop: () => void;
    };
    rec.lang = "en-IN";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript ?? "";
      setHeard(said);
      push(`> voice: "${said}"`);
      const s = said.toLowerCase();
      if (s.includes("trace") || s.includes("location") || s.includes("where")) {
        void runTrace();
      } else if (s.includes("close") || s.includes("exit")) {
        onClose();
      } else {
        speak("Say trace my location, or close.");
      }
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
    setVoiceOn(true);
  }, [listening, onClose, push, runTrace, speak]);

  const markers = useMemo<Marker[]>(() => {
    const m: Marker[] = [{ lat: JH.lat, lon: JH.lon, kind: "target", radar: true }];
    if (fix) m.push({ lat: fix.lat, lon: fix.lon, kind: "you", radar: true });
    return m;
  }, [fix]);

  const focus = fix ?? JH;
  const zoom = fix ? 13 : JH.zoom;

  return (
    <div className="fixed inset-0 z-50 bg-black zoom-punch">
      <SatelliteCanvas
        lat={focus.lat}
        lon={focus.lon}
        zoom={zoom}
        markers={markers}
        className="h-full w-full"
      />

      {/* radar overlay */}
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

      {/* header */}
      <div className="pointer-events-none absolute left-5 top-5">
        <div className="mono-hud text-[10px] uppercase tracking-[0.35em] text-emerald-300">
          Jharkhand · orbital feed
        </div>
        <div className="type-reveal mono-hud mt-1 text-[10px] tracking-[0.2em] text-white/60">
          {clock} · esri world imagery
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mono-hud absolute right-5 top-5 rounded-full border border-white/25 bg-black/70 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-white hover:bg-white/10"
      >
        Close
      </button>

      {/* control rail */}
      <div className="absolute left-5 bottom-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void runTrace()}
          disabled={trace === "tracing"}
          className="mono-hud rounded-full border border-emerald-400/60 bg-emerald-400/15 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-emerald-200 hover:bg-emerald-400/25 disabled:opacity-50"
        >
          {trace === "tracing" ? "Tracing…" : "Trace my location"}
        </button>
        <button
          type="button"
          onClick={toggleVoice}
          className={`mono-hud rounded-full border px-4 py-2 text-[10px] uppercase tracking-[0.3em] ${
            listening
              ? "border-sky-400/70 bg-sky-400/20 text-sky-200"
              : "border-white/25 bg-black/70 text-white/80 hover:bg-white/10"
          }`}
        >
          {listening ? "Listening…" : "Voice chat"}
        </button>
        {heard && (
          <span className="mono-hud text-[10px] text-white/50">“{heard}”</span>
        )}
      </div>

      {/* telemetry panel */}
      <div className="absolute right-5 bottom-5 w-[min(360px,86vw)] space-y-3">
        {street && (
          <img
            src={street}
            alt="Nearest street-level view of the traced location"
            className="trace-in h-36 w-full rounded-md border border-white/15 object-cover"
          />
        )}

        <div className="mono-hud trace-in rounded-md border border-white/15 bg-black/80 p-3 text-[11px] backdrop-blur">
          <div className="mb-2 text-[10px] uppercase tracking-[0.3em] text-emerald-300">
            Live telemetry
          </div>
          {err && <div className="mb-2 text-destructive">{err}</div>}
          <Row k="IP" v={ip?.ip ?? "—"} />
          <Row k="Network" v={ip?.org ?? "—"} />
          <Row
            k="Coords"
            v={fix ? `${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)}` : "—"}
          />
          <Row
            k="Accuracy"
            v={fix ? `±${Math.round(fix.accuracy)} m · ${fix.source}` : "—"}
          />
          <Row k="Street" v={place?.road ?? place?.suburb ?? "—"} />
          <Row k="City" v={place?.city ?? place?.village ?? ip?.city ?? "—"} />
          <Row k="District" v={place?.district ?? "—"} />
          <Row k="State" v={place?.state ?? ip?.region ?? "—"} />
          <Row k="PIN" v={place?.postcode ?? "—"} />
          <Row k="Timezone" v={ip?.timezone ?? "—"} />
          <Signal fix={fix} />
        </div>

        <div className="mono-hud rounded-md border border-white/10 bg-black/70 p-2 text-[10px] text-emerald-300/80">
          {log.length === 0 ? "> standby" : log.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="max-w-[62%] truncate text-right text-foreground">{v}</span>
    </div>
  );
}

/** Animated signal-strength motion graph. */
function Signal({ fix }: { fix: Fix | null }) {
  const [series, setSeries] = useState<number[]>(() => Array.from({ length: 40 }, () => 0.2));
  useEffect(() => {
    const t = setInterval(() => {
      setSeries((s) => [
        ...s.slice(1),
        fix ? 0.45 + Math.random() * 0.5 : 0.1 + Math.random() * 0.2,
      ]);
    }, 220);
    return () => clearInterval(t);
  }, [fix]);
  const d = series
    .map((v, i) => `${(i / (series.length - 1)) * 100},${(1 - v) * 34}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="mt-2 h-10 w-full">
      <polyline
        points={d}
        fill="none"
        stroke="var(--focus-line)"
        strokeWidth={0.9}
        vectorEffect="non-scaling-stroke"
        style={{ filter: "drop-shadow(0 0 3px var(--focus-glow))" }}
      />
    </svg>
  );
}
