import { canonicalCountry } from "../geo/locations";

export type LocationRow = {
  location_code?: number | string;
  location_name?: string;
  location_type?: string;
};

export type ResolvedLocation = {
  locationCode: number;
  locationName: string;
};

export class LocationLookupError extends Error {
  constructor(readonly code: "CREDENTIALS_MISSING" | "LOCATION_NOT_FOUND" | "LOCATION_LOOKUP_FAILED" | "CITY_MISSING") {
    super(code);
  }
}

export function pickLocation(rows: LocationRow[], city: string): ResolvedLocation | null {
  const word = city.trim().toLowerCase();
  if (!word) return null;

  const matches = rows.flatMap((row) => {
    const locationName = typeof row.location_name === "string" ? row.location_name.trim() : "";
    const locationCode = Number(row.location_code);
    if (!locationName || !Number.isInteger(locationCode)) return [];
    if (!locationName.toLowerCase().includes(word)) return [];
    return [{ locationCode, locationName, locationType: (row.location_type ?? "").toLowerCase() }];
  });
  if (!matches.length) return null;

  const score = (item: (typeof matches)[number]) => {
    const name = item.locationName.toLowerCase();
    let value = 0;
    if (name === word || name.startsWith(`${word},`)) value += 100;
    else if (name.startsWith(word)) value += 40;
    if (item.locationType.includes("city") || item.locationType.includes("municip")) value += 20;
    if (item.locationType === "country" || item.locationType === "region") value -= 40;
    return value;
  };

  matches.sort((a, b) => score(b) - score(a) || a.locationName.length - b.locationName.length);
  return { locationCode: matches[0].locationCode, locationName: matches[0].locationName };
}

export function parseCompetitorSettings(body: unknown) {
  const data = body !== null && typeof body === "object" ? body as Record<string, unknown> : null;
  const latitude = coordinate(data?.latitude);
  const longitude = coordinate(data?.longitude);
  if (latitude === null || latitude < -90 || latitude > 90) return { error: "INVALID_POSITION" as const };
  if (longitude === null || longitude < -180 || longitude > 180) return { error: "INVALID_POSITION" as const };
  if (!Array.isArray(data?.mustInclude)) return { error: "INVALID_TAGS" as const };

  const mustInclude: string[] = [];
  const seen = new Set<string>();
  for (const item of data.mustInclude) {
    if (typeof item !== "string") return { error: "INVALID_TAGS" as const };
    const name = item.trim().replace(/\s+/g, " ");
    if (!name || name.length > 120) return { error: "INVALID_TAGS" as const };
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    mustInclude.push(name);
  }
  if (mustInclude.length > 10) return { error: "TOO_MANY" as const };
  return { latitude, longitude, mustInclude };
}

function coordinate(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value.trim().replace(",", ".")) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export async function findHotelLocation(city: string, country: string): Promise<ResolvedLocation> {
  const word = city.trim();
  if (!word) throw new LocationLookupError("CITY_MISSING");
  const iso = canonicalCountry(country).trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(iso)) throw new LocationLookupError("LOCATION_LOOKUP_FAILED");

  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new LocationLookupError("CREDENTIALS_MISSING");

  const response = await fetch(`https://api.dataforseo.com/v3/serp/google/locations/${iso}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
    },
    signal: AbortSignal.timeout(120_000),
  });
  if (response.status === 401 || response.status === 403) throw new LocationLookupError("CREDENTIALS_MISSING");
  if (!response.ok) throw new LocationLookupError("LOCATION_LOOKUP_FAILED");

  const payload = await response.json() as { status_code?: number; tasks?: Array<{ result?: LocationRow[] }> };
  if (payload.status_code === 40100 || payload.status_code === 40200) throw new LocationLookupError("CREDENTIALS_MISSING");
  const rows = payload.tasks?.[0]?.result;
  if (!Array.isArray(rows)) throw new LocationLookupError("LOCATION_LOOKUP_FAILED");

  const match = pickLocation(rows, word);
  if (!match) throw new LocationLookupError("LOCATION_NOT_FOUND");
  return match;
}
