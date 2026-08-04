export type DistrictStat = {
  name: string;
  hq: string;
  areaKm2: number;
  population2011: number;
  literacy: number;
  blocks: number;
};

/** Census 2011 / LGD reference figures for the 24 districts of Jharkhand. */
export const JH_DISTRICTS: DistrictStat[] = [
  { name: "Bokaro", hq: "Bokaro Steel City", areaKm2: 2861, population2011: 2062330, literacy: 72.0, blocks: 9 },
  { name: "Chatra", hq: "Chatra", areaKm2: 3706, population2011: 1042886, literacy: 60.2, blocks: 12 },
  { name: "Deoghar", hq: "Deoghar", areaKm2: 2479, population2011: 1492073, literacy: 64.8, blocks: 10 },
  { name: "Dhanbad", hq: "Dhanbad", areaKm2: 2040, population2011: 2684487, literacy: 74.5, blocks: 10 },
  { name: "Dumka", hq: "Dumka", areaKm2: 3761, population2011: 1321442, literacy: 61.0, blocks: 10 },
  { name: "East Singhbhum", hq: "Jamshedpur", areaKm2: 3533, population2011: 2293919, literacy: 75.5, blocks: 11 },
  { name: "Garhwa", hq: "Garhwa", areaKm2: 4064, population2011: 1322784, literacy: 60.3, blocks: 20 },
  { name: "Giridih", hq: "Giridih", areaKm2: 4854, population2011: 2445474, literacy: 63.1, blocks: 13 },
  { name: "Godda", hq: "Godda", areaKm2: 2110, population2011: 1313551, literacy: 56.4, blocks: 9 },
  { name: "Gumla", hq: "Gumla", areaKm2: 5327, population2011: 1025213, literacy: 65.7, blocks: 12 },
  { name: "Hazaribagh", hq: "Hazaribagh", areaKm2: 4302, population2011: 1734495, literacy: 69.8, blocks: 16 },
  { name: "Jamtara", hq: "Jamtara", areaKm2: 1802, population2011: 791042, literacy: 64.6, blocks: 6 },
  { name: "Khunti", hq: "Khunti", areaKm2: 2535, population2011: 531885, literacy: 63.9, blocks: 6 },
  { name: "Koderma", hq: "Koderma", areaKm2: 1312, population2011: 716259, literacy: 66.8, blocks: 6 },
  { name: "Latehar", hq: "Latehar", areaKm2: 4291, population2011: 726978, literacy: 59.5, blocks: 9 },
  { name: "Lohardaga", hq: "Lohardaga", areaKm2: 1491, population2011: 461790, literacy: 67.6, blocks: 7 },
  { name: "Pakur", hq: "Pakur", areaKm2: 1811, population2011: 900422, literacy: 48.8, blocks: 6 },
  { name: "Palamu", hq: "Medininagar (Daltonganj)", areaKm2: 4393, population2011: 1939869, literacy: 63.6, blocks: 21 },
  { name: "Ramgarh", hq: "Ramgarh Cantonment", areaKm2: 1341, population2011: 949159, literacy: 73.2, blocks: 6 },
  { name: "Ranchi", hq: "Ranchi", areaKm2: 5097, population2011: 2914253, literacy: 76.1, blocks: 18 },
  { name: "Sahibganj", hq: "Sahibganj", areaKm2: 1599, population2011: 1150567, literacy: 52.0, blocks: 9 },
  { name: "Seraikela Kharsawan", hq: "Seraikela", areaKm2: 2657, population2011: 1065056, literacy: 67.7, blocks: 9 },
  { name: "Simdega", hq: "Simdega", areaKm2: 3774, population2011: 599578, literacy: 67.6, blocks: 10 },
  { name: "West Singhbhum", hq: "Chaibasa", areaKm2: 5290, population2011: 1502338, literacy: 58.6, blocks: 18 },
];

export const LOHARDAGA = {
  name: "Lohardaga",
  state: "Jharkhand",
  division: "South Chhotanagpur",
  lat: 23.4333,
  lon: 84.6833,
  areaKm2: 1491,
  population2011: 461790,
  literacy: 67.61,
  densityPerKm2: 310,
  sexRatio: 985,
  blocks: ["Lohardaga", "Kisko", "Kuru", "Bhandra", "Senha", "Kairo", "Peshrar"],
  languages: ["Hindi", "Nagpuri", "Kurukh", "Mundari"],
  known: "Bauxite mining belt of the Chhotanagpur plateau",
  pin: "835302",
  stdCode: "06526",
};

export type Contact = { label: string; value: string; href?: string };

/** Publicly listed offices — verify before official use. */
export const LOHARDAGA_CONTACTS: Contact[] = [
  { label: "Deputy Commissioner, Lohardaga", value: "dc-loh@nic.in", href: "mailto:dc-loh@nic.in" },
  { label: "District Collectorate", value: "+91 6526 224 002", href: "tel:+916526224002" },
  { label: "Superintendent of Police", value: "+91 6526 224 004", href: "tel:+916526224004" },
  { label: "District Website", value: "lohardaga.nic.in", href: "https://lohardaga.nic.in" },
  { label: "Emergency / Police", value: "112", href: "tel:112" },
  { label: "Ambulance", value: "108", href: "tel:108" },
];

export const JH_CONTACTS: Contact[] = [
  { label: "Government of Jharkhand", value: "jharkhand.gov.in", href: "https://www.jharkhand.gov.in" },
  { label: "Chief Minister's Secretariat, Ranchi", value: "+91 651 240 0975", href: "tel:+916512400975" },
  { label: "JharSewa (e-District portal)", value: "jharsewa.jharkhand.gov.in", href: "https://jharsewa.jharkhand.gov.in" },
  { label: "State Disaster Control Room", value: "+91 651 244 6923", href: "tel:+916512446923" },
  { label: "Jharkhand Police Helpline", value: "100 / 112", href: "tel:112" },
  { label: "Jharkhand Tourism", value: "jharkhandtourism.gov.in", href: "https://www.jharkhandtourism.gov.in" },
];
