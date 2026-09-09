const OFFICIAL_ALIASES: Record<string, string> = {
  "andaman and nicobar": "Andaman and Nicobar Islands",
  "dadra and nagar haveli and daman and diu": "Dadra and Nagar Haveli and Daman and Diu",
  "jammu & kashmir": "Jammu and Kashmir",
  "jammu and kashmir": "Jammu and Kashmir",
  "odisha": "Odisha",
  orissa: "Odisha",
  pondicherry: "Puducherry",
  uttaranchal: "Uttarakhand",
};

/** Return a geographic name in Latin script, preferring official English aliases. */
export function normalizeEnglishName(value: string | undefined, fallback?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  const alias = OFFICIAL_ALIASES[trimmed.toLocaleLowerCase()];
  if (alias) return alias;

  // The geocoder is asked for English below, but this final guard prevents a
  // provider regression from ever placing Devanagari or another script in UI.
  const latin = trimmed.replace(/[^\u0000-\u024f\u1e00-\u1eff\u0020-\u007e]/g, "").replace(/\s+/g, " ").trim();
  return /[A-Za-z]/.test(latin) ? latin : fallback;
}

export function normalizeEnglishAddress(value: string | undefined, fallback: string): string {
  const parts = value
    ?.split(",")
    .map((part) => normalizeEnglishName(part))
    .filter((part): part is string => Boolean(part));
  return parts?.length ? parts.join(", ") : fallback;
}