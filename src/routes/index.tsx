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
    <main className="h-screen w-screen bg-background overflow-hidden flex items-center justify-center">
      <div className="w-full h-full">
        <WorldMap />
      </div>
    </main>
  );
}
