export type TourStop = {
  /** Key inside admin1-top20.json */
  admin1Key: string;
  /** properties.name in world-atlas countries-110m */
  worldName: string;
  /** Label shown on screen */
  label: string;
};

/** India first, then the remaining largest countries by land area. */
export const TOUR: TourStop[] = [
  { admin1Key: "India", worldName: "India", label: "India" },
  { admin1Key: "Russia", worldName: "Russia", label: "Russia" },
  { admin1Key: "Canada", worldName: "Canada", label: "Canada" },
  { admin1Key: "China", worldName: "China", label: "China" },
  {
    admin1Key: "United States of America",
    worldName: "United States of America",
    label: "United States",
  },
  { admin1Key: "Brazil", worldName: "Brazil", label: "Brazil" },
  { admin1Key: "Australia", worldName: "Australia", label: "Australia" },
  { admin1Key: "Argentina", worldName: "Argentina", label: "Argentina" },
  { admin1Key: "Kazakhstan", worldName: "Kazakhstan", label: "Kazakhstan" },
  { admin1Key: "Algeria", worldName: "Algeria", label: "Algeria" },
  {
    admin1Key: "Democratic Republic of the Congo",
    worldName: "Dem. Rep. Congo",
    label: "DR Congo",
  },
  { admin1Key: "Saudi Arabia", worldName: "Saudi Arabia", label: "Saudi Arabia" },
  { admin1Key: "Mexico", worldName: "Mexico", label: "Mexico" },
  { admin1Key: "Indonesia", worldName: "Indonesia", label: "Indonesia" },
  { admin1Key: "Sudan", worldName: "Sudan", label: "Sudan" },
  { admin1Key: "Libya", worldName: "Libya", label: "Libya" },
  { admin1Key: "Iran", worldName: "Iran", label: "Iran" },
  { admin1Key: "Mongolia", worldName: "Mongolia", label: "Mongolia" },
  { admin1Key: "Peru", worldName: "Peru", label: "Peru" },
  { admin1Key: "Chad", worldName: "Chad", label: "Chad" },
];
