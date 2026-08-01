import { geoBounds, geoDistance, geoLength } from "d3-geo";
import type { Feature, Geometry, Position } from "geojson";

const R = 6371; // earth radius, km

export type CountryMetrics = {
  perimeterKm: number;
  widthKm: number;
  heightKm: number;
  longestKm: number;
  longest: [Position, Position];
  bounds: [Position, Position];
  north: Position;
  south: Position;
  west: Position;
  east: Position;
};

/** Flatten every coordinate of a geometry into a flat list of [lon, lat]. */
function collectPoints(geometry: Geometry): Position[] {
  const out: Position[] = [];
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      out.push(c as Position);
      return;
    }
    if (Array.isArray(c)) c.forEach(walk);
  };
  if ("coordinates" in geometry) walk((geometry as { coordinates: unknown }).coordinates);
  return out;
}

/** Evenly subsample so the O(n^2) longest-route search stays cheap. */
function subsample(points: Position[], max: number): Position[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  const out: Position[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]!);
  return out;
}

export function computeMetrics(
  feature: Feature<Geometry, unknown>,
): CountryMetrics {
  const bounds = geoBounds(feature) as [Position, Position];
  const [[minLon, minLat], [maxLon, maxLat]] = bounds;
  const midLat = (minLat + maxLat) / 2;
  const midLon = (minLon + maxLon) / 2;

  const perimeterKm = geoLength(feature) * R;
  const widthKm = geoDistance([minLon, midLat], [maxLon, midLat]) * R;
  const heightKm = geoDistance([midLon, minLat], [midLon, maxLat]) * R;

  const pts = subsample(collectPoints(feature.geometry), 220);
  let longest: [Position, Position] = [
    [minLon, midLat],
    [maxLon, midLat],
  ];
  let longestRad = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const d = geoDistance(pts[i]!, pts[j]!);
      if (d > longestRad) {
        longestRad = d;
        longest = [pts[i]!, pts[j]!];
      }
    }
  }

  // Extreme cardinal points, useful for the N-S / E-W guide lines.
  let north = pts[0] ?? [midLon, maxLat];
  let south = pts[0] ?? [midLon, minLat];
  let west = pts[0] ?? [minLon, midLat];
  let east = pts[0] ?? [maxLon, midLat];
  for (const p of pts) {
    if (p[1]! > north[1]!) north = p;
    if (p[1]! < south[1]!) south = p;
    if (p[0]! < west[0]!) west = p;
    if (p[0]! > east[0]!) east = p;
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
