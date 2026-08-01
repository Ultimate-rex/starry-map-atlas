import { createFileRoute } from "@tanstack/react-router";
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
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-6 py-16">
      <header className="mb-10 text-center">
        <h1 className="text-3xl md:text-5xl font-light tracking-[0.3em] uppercase">
          World Map
        </h1>
        <p className="mt-3 text-sm text-muted-foreground tracking-widest uppercase">
          Natural Earth projection · D3
        </p>
      </header>
      <div className="w-full max-w-6xl">
        <WorldMap />
      </div>
    </main>
  );
}
