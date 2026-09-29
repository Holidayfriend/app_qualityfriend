export const starCategories = ["1", "2", "3", "3S", "4", "4S", "5", "5S"] as const;

export type StarCategory = (typeof starCategories)[number];

const allowed = new Set<string>(starCategories);

export function parseStarCategory(raw: unknown): StarCategory | null | undefined {
  if (raw === "" || raw == null) return null;
  const value = String(raw).trim().toUpperCase().replace(/[\s,]+/g, "").replace(",", ".");
  const whole = /^([1-5])(?:\.0+)?$/.exec(value);
  const code = whole ? whole[1] : value;
  return allowed.has(code) ? (code as StarCategory) : undefined;
}
