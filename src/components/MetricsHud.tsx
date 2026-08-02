import { useCountUp } from "@/hooks/useCountUp";
import { formatKm, type CountryMetrics } from "@/lib/geoMetrics";

type Props = {
  label: string;
  metrics: CountryMetrics;
  states: number;
  runKey: string | number;
  /** "tour" = blue instruments, "focus" = green (clicked country). */
  accent?: "tour" | "focus";
};

function Row({
  k,
  value,
  runKey,
  color,
}: {
  k: string;
  value: number;
  runKey: string | number;
  color: string;
}) {
  const v = useCountUp(value, 1400, runKey);
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-[10px] tracking-[0.28em] uppercase text-muted-foreground">
        {k}
      </span>
      <span className="mono-hud tabular-nums text-sm" style={{ color }}>
        {formatKm(v)}
      </span>
    </div>
  );
}

/** Read-out of the measured geometry for the focused country. */
export function MetricsHud({
  label,
  metrics,
  states,
  runKey,
  accent = "tour",
}: Props) {
  const color =
    accent === "focus" ? "var(--focus-line)" : "var(--state-line)";
  return (
    <div
      key={runKey}
      className={`hud-in pointer-events-none absolute right-5 ${accent === "focus" ? "bottom-24" : "top-5"} w-64 rounded-md border border-white/15 bg-black/70 p-4 backdrop-blur-sm`}
      style={{ borderColor: `color-mix(in oklab, ${color} 45%, transparent)` }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-xs tracking-[0.3em] uppercase text-foreground">
          {label}
        </span>
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground">
          {states} ADM1
        </span>
      </div>
      <div className="space-y-2">
        <Row k="Border length" value={metrics.perimeterKm} runKey={runKey} color={color} />
        <Row k="Width E–W" value={metrics.widthKm} runKey={runKey} color={color} />
        <Row k="Height N–S" value={metrics.heightKm} runKey={runKey} color={color} />
        <Row k="Longest route" value={metrics.longestKm} runKey={runKey} color={color} />
      </div>
      <div className="mt-3 h-px w-full bg-white/10" />
      <p className="mt-2 text-[10px] leading-relaxed tracking-wider text-muted-foreground">
        Great-circle measurements sampled from the national boundary.
      </p>
    </div>
  );
}
