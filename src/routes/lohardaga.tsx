import { createFileRoute, Link } from "@tanstack/react-router";
import { geoMercator, geoPath } from "d3-geo";
import { useMemo, useState } from "react";
import type { Feature, Geometry } from "geojson";
import lohardaga from "@/data/lohardaga.json";
import { JharkhandMap } from "@/components/JharkhandMap";
import { SatelliteCanvas } from "@/components/SatelliteCanvas";
import { JharkhandStarlight } from "@/components/JharkhandStarlight";
import {
  JH_CONTACTS,
  JH_DISTRICTS,
  LOHARDAGA,
  LOHARDAGA_CONTACTS,
} from "@/data/jhInfo";

const LOH = lohardaga as unknown as Feature<Geometry, { name: string }>;

export const Route = createFileRoute("/lohardaga")({
  head: () => ({
    meta: [
      { title: "Lohardaga & Jharkhand District Atlas — Maps, Data, Contacts" },
      {
        name: "description",
        content:
          "Satellite view of Lohardaga, animated Jharkhand district border map, district-wise analytics and official contact directory.",
      },
      {
        property: "og:title",
        content: "Lohardaga & Jharkhand District Atlas",
      },
      {
        property: "og:description",
        content:
          "Satellite imagery, district borders, census analytics and contacts for Lohardaga and all 24 Jharkhand districts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function LohardagaOutline() {
  const d = useMemo(() => {
    const p = geoPath(
      geoMercator().fitExtent(
        [
          [16, 16],
          [384, 288],
        ],
        LOH as never,
      ),
    );
    return p(LOH) ?? "";
  }, []);
  return (
    <svg viewBox="0 0 400 304" className="w-full h-auto" role="img" aria-label="Lohardaga district outline">
      <rect width={400} height={304} fill="#05070a" />
      <path
        d={d}
        className="state-path"
        pathLength={1}
        strokeDasharray={1}
        fill="rgba(52,211,153,0.12)"
        stroke="var(--focus-line)"
        strokeWidth={2}
        style={{ filter: "drop-shadow(0 0 6px var(--focus-glow))" }}
      />
    </svg>
  );
}

function Page() {
  const sorted = [...JH_DISTRICTS].sort((a, b) => b.population2011 - a.population2011);
  const totalPop = JH_DISTRICTS.reduce((s, d) => s + d.population2011, 0);
  const totalArea = JH_DISTRICTS.reduce((s, d) => s + d.areaKm2, 0);
  const maxPop = sorted[0]!.population2011;
  const [starlight, setStarlight] = useState(false);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <Link
          to="/"
          className="mono-hud text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground"
        >
          ← World map
        </Link>

        <h1 className="mt-6 text-3xl md:text-5xl font-light uppercase tracking-[0.15em]">
          Lohardaga
        </h1>
        <p className="mono-hud mt-2 text-xs uppercase tracking-[0.3em] text-emerald-300">
          {LOHARDAGA.division} division · {LOHARDAGA.state} · {LOHARDAGA.lat}°N{" "}
          {LOHARDAGA.lon}°E
        </p>

        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <SatelliteCanvas
            lat={LOHARDAGA.lat}
            lon={LOHARDAGA.lon}
            zoom={11}
            markers={[{ lat: LOHARDAGA.lat, lon: LOHARDAGA.lon, radar: true }]}
            className="h-[320px] w-full rounded-lg border border-white/15"
          />
          <div className="rounded-lg border border-white/15 p-4">
            <h2 className="mono-hud text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              District outline
            </h2>
            <LohardagaOutline />
            <dl className="mono-hud mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-[11px]">
              <Stat k="Area" v={`${LOHARDAGA.areaKm2.toLocaleString("en-IN")} km²`} />
              <Stat k="Population (2011)" v={LOHARDAGA.population2011.toLocaleString("en-IN")} />
              <Stat k="Literacy" v={`${LOHARDAGA.literacy}%`} />
              <Stat k="Density" v={`${LOHARDAGA.densityPerKm2}/km²`} />
              <Stat k="Sex ratio" v={`${LOHARDAGA.sexRatio}/1000`} />
              <Stat k="PIN / STD" v={`${LOHARDAGA.pin} / ${LOHARDAGA.stdCode}`} />
              <Stat k="Blocks" v={LOHARDAGA.blocks.join(", ")} />
              <Stat k="Languages" v={LOHARDAGA.languages.join(", ")} />
            </dl>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-light uppercase tracking-[0.25em]">
            Jharkhand district borders
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All 24 districts, drawn with an animated border build-up. Hover a
            district for its census read-out.
          </p>
          <div className="mt-4 rounded-lg border border-white/15 overflow-hidden">
            <JharkhandMap highlight="Lohardaga" onSelect={() => setStarlight(true)} />
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-light uppercase tracking-[0.25em]">
            District analysis
          </h2>
          <p className="mono-hud mt-1 text-[11px] text-muted-foreground">
            {JH_DISTRICTS.length} districts · {totalArea.toLocaleString("en-IN")} km²
            · {totalPop.toLocaleString("en-IN")} people (Census 2011)
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-white/15">
            <table className="mono-hud w-full min-w-[640px] text-left text-[11px]">
              <thead className="bg-white/5 text-muted-foreground uppercase tracking-[0.2em]">
                <tr>
                  <th className="px-3 py-2">District</th>
                  <th className="px-3 py-2">HQ</th>
                  <th className="px-3 py-2 text-right">Area km²</th>
                  <th className="px-3 py-2 text-right">Population</th>
                  <th className="px-3 py-2 text-right">Literacy</th>
                  <th className="px-3 py-2 w-40">Share</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr
                    key={d.name}
                    className={`border-t border-white/10 ${
                      d.name === "Lohardaga" ? "bg-emerald-400/10 text-emerald-200" : ""
                    }`}
                  >
                    <td className="px-3 py-2">{d.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.hq}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {d.areaKm2.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {d.population2011.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.literacy}%</td>
                    <td className="px-3 py-2">
                      <div className="h-1.5 w-full bg-white/10">
                        <div
                          className="h-1.5 bg-emerald-400/80"
                          style={{ width: `${(d.population2011 / maxPop) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12 grid gap-6 md:grid-cols-2 pb-16">
          <ContactCard title="Lohardaga contacts" items={LOHARDAGA_CONTACTS} />
          <ContactCard title="Jharkhand state contacts" items={JH_CONTACTS} />
        </section>
      </div>
      {starlight && <JharkhandStarlight onClose={() => setStarlight(false)} />}
    </main>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="col-span-2 flex justify-between gap-4 border-b border-white/10 py-1">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function ContactCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string; href?: string }[];
}) {
  return (
    <div className="rounded-lg border border-white/15 p-4">
      <h3 className="mono-hud text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        {title}
      </h3>
      <ul className="mono-hud mt-3 space-y-2 text-[12px]">
        {items.map((c) => (
          <li key={c.label} className="flex justify-between gap-4 border-b border-white/10 pb-1">
            <span className="text-muted-foreground">{c.label}</span>
            {c.href ? (
              <a
                href={c.href}
                target={c.href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="text-emerald-300 hover:underline"
              >
                {c.value}
              </a>
            ) : (
              <span>{c.value}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Publicly listed numbers — please verify on the official portal before
        official correspondence.
      </p>
    </div>
  );
}
