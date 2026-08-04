import { createFileRoute, Link } from "@tanstack/react-router";
import { WorldMap } from "@/components/WorldMap";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "World Map — Interactive D3 Country Atlas" },
      {
        name: "description",
        content:
          "A minimal black-and-white interactive world map of every country, rendered with D3 geographic projections.",
      },
      { property: "og:title", content: "World Map — Interactive D3 Country Atlas" },
      {
        property: "og:description",
        content:
          "A minimal black-and-white interactive world map of every country, rendered with D3.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="h-screen w-screen bg-background overflow-hidden flex items-center justify-center">
      <div className="w-full h-full">
        <WorldMap />
      </div>
      <Link
        to="/lohardaga"
        className="absolute right-5 top-5 rounded-full border border-emerald-400/50 bg-black/70 px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-emerald-300 hover:bg-emerald-400/15 transition-colors"
      >
        Lohardaga / JH atlas
      </Link>
    </main>
  );
}

