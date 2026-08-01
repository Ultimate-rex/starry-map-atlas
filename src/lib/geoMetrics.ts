import { geoBounds, geoDistance, geoLength } from "d3-geo";
import type { Feature, Geometry } from "geojson";

const R = 6371; // earth radius, km

export type Pt = [number, number];

export type CountryMetrics = {
  perimeterKm: number;
  widthKm: number;
  heightKm: number;
  longestKm: number;
  longest: [Pt, Pt];
  bounds: [Pt, Pt];
  north: Pt;
  south: Pt;
  west: Pt;
  east: Pt;
};

/** Flatten every coordinate of a geometry into a flat list of [lon, lat]. */
function collectPoints(geometry: Geometry): Pt[] {
  const out: Pt[] = [];
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      out.push([c[0] as number, c[1] as number]);
      return;
    }
    if (Array.isArray(c)) c.forEach(walk);
  };
  if ("coordinates" in geometry)
    walk((geometry as { coordinates: unknown }).coordinates);
  return out;
}

/** Evenly subsample so the O(n^2) longest-route search stays cheap. */
function subsample(points: Pt[], max: number): Pt[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out: Pt[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)] as Pt);
  return out;
}

export function computeMetrics(feature: Feature<Geometry, unknown>): CountryMetrics {
  const geo = feature as never;
  const b = geoBounds(geo) as [Pt, Pt];
  const bounds: [Pt, Pt] = [
    [b[0][0], b[0][1]],
    [b[1][0], b[1][1]],
  ];
  const minLon = bounds[0][0];
  const minLat = bounds[0][1];
  const maxLon = bounds[1][0];
  const maxLat = bounds[1][1];
  const midLat = (minLat + maxLat) / 2;
  const midLon = (minLon + maxLon) / 2;

  const perimeterKm = geoLength(geo) * R;
  const widthKm = geoDistance([minLon, midLat], [maxLon, midLat]) * R;
  const heightKm = geoDistance([midLon, minLat], [midLon, maxLat]) * R;

  const pts = subsample(collectPoints(feature.geometry), 220);
  let longest: [Pt, Pt] = [
    [minLon, midLat],
    [maxLon, midLat],
  ];
  let longestRad = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i] as Pt;
    for (let j = i + 1; j < pts.length; j++) {
      const c = pts[j] as Pt;
      const d = geoDistance(a, c);
      if (d > longestRad) {
        longestRad = d;
        longest = [a, c];
      }
    }
  }

  // Extreme cardinal points, used for the N-S / E-W guide lines.
  let north: Pt = pts[0] ?? [midLon, maxLat];
  let south: Pt = pts[0] ?? [midLon, minLat];
  let west: Pt = pts[0] ?? [minLon, midLat];
  let east: Pt = pts[0] ?? [maxLon, midLat];
  for (const p of pts) {
    if (p[1] > north[1]) north = p;
    if (p[1] < south[1]) south = p;
    if (p[0] < west[0]) west = p;
    if (p[0] > east[0]) east = p;
  }

  return {
    perimeterKm,
    widthKm,
    heightKm,
    longestKm: longestRad * R,
    longest,
    bounds,
    north,
    south,
    west,
    east,
  };
}

export function formatKm(v: number): string {
  return `${Math.round(v).toLocaleString("en-US")} km`;
}
