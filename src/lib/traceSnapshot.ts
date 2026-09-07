import { supabase } from "@/integrations/supabase/client";
import type { DeviceSnapshot, Fix, IpInfo, PlaceInfo } from "@/lib/geoTrace";

export const LOCAL_TRACE_KEY = "lv.trace.user.json";
const LOCAL_HISTORY_KEY = "lv.trace.history.v1";

export type TraceSnapshot = {
  version: 1;
  userId: string | null;
  capturedAt: string;
  consentedAt: string;
  coordinates: {
    latitude: number;
    longitude: number;
    accuracyMeters: number;
    source: Fix["source"];
  };
  address: PlaceInfo | null;
  network: IpInfo | null;
  device: DeviceSnapshot;
};

export function buildTraceSnapshot(
  fix: Fix,
  ip: IpInfo | null,
  place: PlaceInfo | null,
  device: DeviceSnapshot,
  userId: string | null,
): TraceSnapshot {
  const capturedAt = new Date().toISOString();
  return {
    version: 1,
    userId,
    capturedAt,
    consentedAt: capturedAt,
    coordinates: {
      latitude: fix.lat,
      longitude: fix.lon,
      accuracyMeters: fix.accuracy,
      source: fix.source,
    },
    address: place,
    network: ip,
    device,
  };
}

/** Keep the latest user.json plus a short local history for offline recovery. */
export function persistLocalTrace(snapshot: TraceSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(snapshot, null, 2);
    localStorage.setItem(LOCAL_TRACE_KEY, serialized);
    const previous = JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) ?? "[]") as unknown;
    const history = Array.isArray(previous) ? previous : [];
    localStorage.setItem(
      LOCAL_HISTORY_KEY,
      JSON.stringify([snapshot, ...history.filter((item) => item && typeof item === "object").slice(0, 49)]),
    );
  } catch {
    // Private browsing or storage limits should not stop the database save.
  }
}

export function downloadTraceJson(snapshot: TraceSnapshot): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `user-${snapshot.coordinates.latitude.toFixed(5)}-${snapshot.coordinates.longitude.toFixed(5)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function saveTraceToDatabase(snapshot: TraceSnapshot, userId: string): Promise<void> {
  const { error } = await supabase.from("location_traces").insert({
    user_id: userId,
    latitude: snapshot.coordinates.latitude,
    longitude: snapshot.coordinates.longitude,
    accuracy_m: snapshot.coordinates.accuracyMeters,
    source: snapshot.coordinates.source,
    ip_address: snapshot.network?.ip && snapshot.network.ip !== "—" ? snapshot.network.ip : null,
    city: snapshot.address?.city ?? snapshot.address?.village ?? snapshot.network?.city ?? null,
    region: snapshot.address?.state ?? snapshot.network?.region ?? null,
    country: snapshot.address?.country ?? snapshot.network?.country ?? null,
    organization: snapshot.network?.org ?? null,
    timezone: snapshot.network?.timezone ?? snapshot.device.timezone,
    device_info: {
      ...snapshot.device,
      address: snapshot.address,
      network: snapshot.network,
      traceSavedAt: snapshot.capturedAt,
    },
    consented_at: snapshot.consentedAt,
  });
  if (error) throw error;
}