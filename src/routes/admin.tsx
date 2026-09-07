import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AdminAccess } from "@/components/AdminAccess";
import { AdminMap, type TraceRecord } from "@/components/AdminMap";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getBrowserFix, getDeviceSnapshot, getIpInfo, reverseGeocode, type Fix, type IpInfo, type PlaceInfo } from "@/lib/geoTrace";
import { buildTraceSnapshot, persistLocalTrace, saveTraceToDatabase } from "@/lib/traceSnapshot";

type PanelState = "checking" | "signed-out" | "not-admin" | "ready" | "error";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Location Console — India Map" },
      {
        name: "description",
        content: "Protected admin console for reviewing consented location trace records on an India map.",
      },
      { property: "og:title", content: "Admin Location Console — India Map" },
      {
        property: "og:description",
        content: "A protected India map for reviewing consented location trace records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<PanelState>("checking");
  const [records, setRecords] = useState<TraceRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [adminTraceState, setAdminTraceState] = useState<"idle" | "tracing" | "saved" | "error">("idle");

  const loadRecords = useCallback(async () => {
    const { data, error } = await supabase
      .from("location_traces")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      setState("error");
      setMessage("The saved trace records could not be loaded.");
      return;
    }
    setRecords(data ?? []);
    setState("ready");
  }, []);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const checkAccess = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!active) return;
      const user = sessionData.session?.user;
      if (!user) {
        setState("signed-out");
        return;
      }

      const { data: role, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!active) return;
      if (roleError) {
        setState("error");
        setMessage("Admin access could not be verified.");
        return;
      }
      if (!role) {
        setState("not-admin");
        return;
      }

      await loadRecords();
      if (!active) return;
      channel = supabase
        .channel("admin-location-traces")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "location_traces" },
          () => void loadRecords(),
        )
        .subscribe();
    };

    void checkAccess();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadRecords]);

  const signOut = async () => {
    await supabase.auth.signOut();
    await navigate({ to: "/", replace: true });
  };

  const traceAdminLocation = async () => {
    setAdminTraceState("tracing");
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("signed out");
      const [ipResult, gpsResult] = await Promise.allSettled([getIpInfo(), getBrowserFix()]);
      const ip: IpInfo | null = ipResult.status === "fulfilled" ? ipResult.value : null;
      const fix: Fix | null = gpsResult.status === "fulfilled"
        ? gpsResult.value
        : ip?.lat != null && ip.lon != null
          ? { lat: ip.lat, lon: ip.lon, accuracy: 5000, source: "ip" }
          : null;
      if (!fix) throw new Error("no location");
      const place: PlaceInfo | null = await reverseGeocode(fix.lat, fix.lon).catch(() => null);
      const snapshot = buildTraceSnapshot(fix, ip, place, getDeviceSnapshot(), userData.user.id);
      persistLocalTrace(snapshot);
      await saveTraceToDatabase(snapshot, userData.user.id);
      setAdminTraceState("saved");
      await loadRecords();
    } catch {
      setAdminTraceState("error");
    }
  };

  const selected = records.find((record) => record.id === selectedId) ?? null;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4 md:px-8">
        <div>
          <p className="mono-hud text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Protected console</p>
          <h1 className="mt-1 text-xl font-medium tracking-tight">India location targets</h1>
        </div>
        <div className="flex items-center gap-2">
          <AdminAccess />
          <Button type="button" variant="destructive" size="sm" onClick={() => void traceAdminLocation()} disabled={adminTraceState === "tracing"}>
            {adminTraceState === "tracing" ? "Tracing…" : adminTraceState === "saved" ? "Admin trace saved" : "Trace admin location"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>

      {state === "checking" && <PanelMessage>Checking admin access…</PanelMessage>}
      {state === "signed-out" && (
        <PanelMessage>
          Sign in with a Cloud account that has the separate admin role to open this console.
        </PanelMessage>
      )}
      {state === "not-admin" && (
        <PanelMessage>
          This account is signed in, but it is not approved for the admin console.
        </PanelMessage>
      )}
      {state === "error" && <PanelMessage>{message}</PanelMessage>}

      {state === "ready" && (
        <div className="mx-auto max-w-[1500px] p-5 md:p-8">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <section className="overflow-hidden border border-border/60">
              <AdminMap records={records} selectedId={selectedId} onSelect={(record) => setSelectedId(record.id)} />
            </section>

            <aside className="border border-border/60 bg-card p-4 text-card-foreground">
              <div className="grid grid-cols-2 gap-3 border-b border-border/60 pb-4">
                <Stat label="Saved traces" value={String(records.length)} />
                <Stat label="Map scope" value="India" />
              </div>
              {selected ? <RecordDetails record={selected} /> : <p className="mt-5 text-sm text-muted-foreground">Select a red target to inspect its saved snapshot.</p>}
            </aside>
          </div>
          <Link to="/" className="mt-5 inline-block text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Return to world map
          </Link>
        </div>
      )}
    </main>
  );
}

function PanelMessage({ children }: { children: React.ReactNode }) {
  return <div className="grid min-h-[60vh] place-items-center px-5 text-center text-sm text-muted-foreground">{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mono-hud text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg tabular-nums">{value}</p>
    </div>
  );
}

function RecordDetails({ record }: { record: TraceRecord }) {
  const device = record.device_info && typeof record.device_info === "object" ? record.device_info : {};
  return (
    <div className="mt-5 space-y-3 text-sm">
      <div className="border-b border-border/60 pb-3">
        <p className="mono-hud text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Coordinates</p>
        <p className="mono-hud mt-1 text-destructive">{record.latitude.toFixed(6)}, {record.longitude.toFixed(6)}</p>
      </div>
      <Detail label="Captured" value={new Date(record.created_at).toLocaleString()} />
      <Detail label="Accuracy" value={record.accuracy_m ? `±${Math.round(record.accuracy_m)} m` : "—"} />
      <Detail label="Source" value={record.source} />
      <Detail label="Place" value={[record.city, record.region, record.country].filter(Boolean).join(", ") || "—"} />
      <Detail label="IP" value={record.ip_address ? String(record.ip_address) : "—"} />
      <Detail label="Network" value={record.organization ?? "—"} />
      <div className="border-t border-border/60 pt-3">
        <p className="mono-hud text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Device snapshot</p>
        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words bg-background p-2 text-[10px] leading-4 text-muted-foreground">
          {JSON.stringify(device, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[62%] text-right break-words">{value}</span>
    </div>
  );
}