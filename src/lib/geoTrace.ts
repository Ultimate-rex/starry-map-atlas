/** Client-side location tracing helpers (browser only). */

export type IpInfo = {
  ip: string;
  city?: string | undefined;
  region?: string | undefined;
  country?: string | undefined;
  org?: string | undefined;
  lat?: number | undefined;
  lon?: number | undefined;
  timezone?: string | undefined;
};

export type PlaceInfo = {
  displayName: string;
  road?: string | undefined;
  suburb?: string | undefined;
  village?: string | undefined;
  city?: string | undefined;
  district?: string | undefined;
  state?: string | undefined;
  postcode?: string | undefined;
  country?: string | undefined;
};

export type Fix = {
  lat: number;
  lon: number;
  accuracy: number;
  source: "gps" | "ip";
};

/** Ask the browser for a precise GPS/Wi-Fi fix. */
export function getBrowserFix(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not available in this browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lon: p.coords.longitude,
          accuracy: p.coords.accuracy ?? 0,
          source: "gps",
        }),
      (e) => reject(new Error(e.message || "Location permission denied")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

/** Public IP + coarse network location. */
export async function getIpInfo(): Promise<IpInfo> {
  const r = await fetch("https://ipapi.co/json/");
  if (!r.ok) throw new Error("IP lookup failed");
  const j = (await r.json()) as Record<string, unknown>;
  return {
    ip: String(j['ip'] ?? "—"),
    city: j['city'] as string | undefined,
    region: j['region'] as string | undefined,
    country: j['country_name'] as string | undefined,
    org: j['org'] as string | undefined,
    lat: typeof j['latitude'] === "number" ? (j['latitude'] as number) : undefined,
    lon: typeof j['longitude'] === "number" ? (j['longitude'] as number) : undefined,
    timezone: j['timezone'] as string | undefined,
  };
}

/** Reverse geocode a coordinate to a street-level address (OpenStreetMap). */
export async function reverseGeocode(lat: number, lon: number): Promise<PlaceInfo> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("Reverse geocode failed");
  const j = (await r.json()) as {
    display_name?: string | undefined;
    address?: Record<string, string>;
  };
  const a = j.address ?? {};
  return {
    displayName: j.display_name ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    road: a['road'] ?? a['pedestrian'] ?? a['neighbourhood'],
    suburb: a['suburb'],
    village: a['village'] ?? a['town'],
    city: a['city'] ?? a['municipality'],
    district: a['state_district'] ?? a['county'],
    state: a['state'],
    postcode: a['postcode'],
    country: a['country'],
  };
}

/** A few satellite stills of the same point at different altitudes. */
export function satelliteStills(
  lat: number,
  lon: number,
): { z: number; label: string; url: string }[] {
  const tile = (z: number) => {
    const n = 2 ** z;
    const x = Math.floor(((lon + 180) / 360) * n);
    const r = (lat * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n,
    );
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  };
  return [
    { z: 18, label: "rooftop", url: tile(18) },
    { z: 15, label: "block", url: tile(15) },
    { z: 12, label: "city", url: tile(12) },
    { z: 9, label: "region", url: tile(9) },
  ];
}

/** Nearest street-level photo (Mapillary open imagery), if any. */
export async function nearestStreetImage(
  lat: number,
  lon: number,
): Promise<string | null> {
  try {
    const d = 0.004;
    const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;
    const r = await fetch(
      `https://graph.mapillary.com/images?fields=thumb_1024_url&bbox=${bbox}&limit=1&access_token=MLY|4142433049200173|72206abe5035850d6743b23a49c41333`,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: { thumb_1024_url?: string }[] };
    return j.data?.[0]?.thumb_1024_url ?? null;
  } catch {
    return null;
  }
}
