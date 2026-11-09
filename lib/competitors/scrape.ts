import { LocationLookupError } from "./location";

const SEARCH_URL = "https://api.dataforseo.com/v3/business_data/google/hotel_searches";
export const DAYS_AHEAD = [10, 24, 45, 90];
export const NIGHTS = 1;
export const RADIUS_KM = 6;

export type SearchHotel = {
  key: string;
  title: string;
  own: boolean;
  stars: number | null;
  rating: number | null;
  reviewCount: number | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  image: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  prices: Record<string, number>;
  raw: Record<string, unknown>;
};

type HotelItem = {
  title?: string;
  hotel_identifier?: string;
  stars?: number | null;
  location?: { latitude?: number; longitude?: number };
  reviews?: { value?: number; votes_count?: number };
  overview_images?: string[];
  prices?: { price?: number };
};

type TaskMeta = { date: string };

export function searchKeywords(hotel: { city: string; streetAddress: string; hotelName: string }) {
  const city = hotel.city.trim();
  const street = hotel.streetAddress.trim();
  const name = hotel.hotelName.trim();
  return [`hotels in ${city}`, `hotels in ${street}`, `hotels near ${name} ${city}`];
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function checkInDates(now: Date, daysAhead = DAYS_AHEAD, nights = NIGHTS) {
  return daysAhead.map((days) => {
    const checkIn = isoDate(now, days);
    return { checkIn, checkOut: isoDate(now, days + nights), date: checkIn };
  });
}

export function selectHotels(
  batches: Array<{ date: string; items: HotelItem[] }>,
  origin: { latitude: number; longitude: number },
  hotelName: string,
  mustInclude: string[],
  radiusKm = RADIUS_KM,
) {
  const merged = new Map<string, { item: HotelItem; prices: Record<string, number> }>();
  for (const batch of batches) {
    for (const item of batch.items) {
      const title = item.title?.trim();
      if (!title) continue;
      const key = (item.hotel_identifier || title).slice(0, 120);
      const current = merged.get(key) ?? { item: { ...item, title }, prices: {} };
      const price = typeof item.prices?.price === "number" ? item.prices.price : 0;
      if (price > 0 && (current.prices[batch.date] === undefined || price < current.prices[batch.date])) current.prices[batch.date] = price;
      merged.set(key, current);
    }
  }

  const titles = [...merged.values()].map((entry) => entry.item.title ?? "");
  const mustHave = mustInclude.map((name) => ({
    name,
    found: titles.some((title) => title.toLowerCase().includes(name.trim().toLowerCase())),
  }));

  const hotels = [...merged.entries()].flatMap(([key, entry]) => {
    const latitude = numberOrNull(entry.item.location?.latitude);
    const longitude = numberOrNull(entry.item.location?.longitude);
    const distance = latitude !== null && longitude !== null ? distanceKm(origin.latitude, origin.longitude, latitude, longitude) : null;
    if (distance !== null && distance > radiusKm) return [];
    const amounts = Object.values(entry.prices);
    const own = isOwnHotel(entry.item.title ?? "", hotelName);
    const title = own ? `[OWN HOTEL] ${entry.item.title}` : entry.item.title ?? "";
    return [{
      key,
      title,
      own,
      stars: numberOrNull(entry.item.stars),
      rating: numberOrNull(entry.item.reviews?.value),
      reviewCount: numberOrNull(entry.item.reviews?.votes_count),
      latitude,
      longitude,
      distanceKm: distance,
      image: entry.item.overview_images?.find((image) => typeof image === "string" && image.trim()) ?? null,
      minPrice: amounts.length ? Math.min(...amounts) : null,
      maxPrice: amounts.length ? Math.max(...amounts) : null,
      prices: entry.prices,
      raw: { ...entry.item, title, distKm: distance, priceList: entry.prices, own },
    } satisfies SearchHotel];
  });

  hotels.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  return { hotels, mustHave };
}

export async function searchCompetitorHotels(input: {
  locationCode: number;
  latitude: number;
  longitude: number;
  city: string;
  streetAddress: string;
  hotelName: string;
  mustInclude: string[];
  now?: Date;
  sleep?: (ms: number) => Promise<void>;
}) {
  const login = process.env.DATAFORSEO_LOGIN?.trim();
  const password = process.env.DATAFORSEO_PASSWORD?.trim();
  if (!login || !password) throw new LocationLookupError("CREDENTIALS_MISSING");

  const now = input.now ?? new Date();
  const dates = checkInDates(now);
  const keywords = searchKeywords(input);
  const tasks = keywords.flatMap((keyword) => dates.map((stay) => ({
    task: {
      keyword,
      location_code: input.locationCode,
      language_code: "en",
      check_in: stay.checkIn,
      check_out: stay.checkOut,
      adults: 2,
      currency: "EUR",
      priority: 2,
    },
    meta: { date: stay.date } satisfies TaskMeta,
  })));

  const pending = new Map<string, TaskMeta>();
  for (let index = 0; index < tasks.length; index += 50) {
    const chunk = tasks.slice(index, index + 50);
    const posted = await dataForSeo<{ tasks?: Array<{ id?: string; status_code?: number }> }>("POST", `${SEARCH_URL}/task_post`, chunk.map((item) => item.task), login, password);
    for (const [taskIndex, task] of (posted.tasks ?? []).entries()) {
      if (task.status_code === 20100 && task.id) pending.set(task.id, chunk[taskIndex].meta);
    }
  }
  if (!pending.size) throw new LocationLookupError("LOCATION_LOOKUP_FAILED");

  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const batches: Array<{ date: string; items: HotelItem[] }> = [];
  for (let round = 0; round < 36 && pending.size; round += 1) {
    await sleep(10_000);
    for (const [id, meta] of [...pending]) {
      const result = await dataForSeo<{ tasks?: Array<{ status_code?: number; result?: Array<{ items?: HotelItem[] }> }> }>("GET", `${SEARCH_URL}/task_get/${id}`, undefined, login, password);
      const task = result.tasks?.[0];
      const code = task?.status_code ?? 0;
      if (code === 20000) {
        batches.push({ date: meta.date, items: task?.result?.[0]?.items ?? [] });
        pending.delete(id);
      } else if (code >= 40000 && code !== 40601 && code !== 40602) {
        pending.delete(id);
      }
    }
  }

  return selectHotels(batches, input, input.hotelName, input.mustInclude);
}

function isoDate(now: Date, days: number) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days)).toISOString().slice(0, 10);
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isOwnHotel(title: string, hotelName: string) {
  const needle = hotelName.toLowerCase().replace(/^hotel\s+/, "").trim();
  return needle.length >= 4 && title.toLowerCase().includes(needle);
}

async function dataForSeo<T>(method: string, url: string, body: unknown, login: string, password: string): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  if (response.status === 401 || response.status === 403) throw new LocationLookupError("CREDENTIALS_MISSING");
  if (!response.ok) throw new LocationLookupError("LOCATION_LOOKUP_FAILED");
  const payload = await response.json() as T & { status_code?: number };
  if (payload.status_code === 40100 || payload.status_code === 40200) throw new LocationLookupError("CREDENTIALS_MISSING");
  return payload;
}
