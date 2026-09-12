type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}
function text(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function number(value: unknown) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeCompetitor(value: unknown) {
  const hotel = object(value), review = object(hotel.review_summary), prices = object(hotel.price_ranges), geo = object(hotel.geo);
  const external_key = text(hotel.key), name = text(hotel.name);
  if (!external_key || external_key.length > 120 || !name) throw new Error("Xotelo returned a hotel without a valid key or name.");
  const rating = number(review.rating), count = number(review.count);
  const lat = number(geo.latitude), lon = number(geo.longitude);
  const min = number(prices.minimum), max = number(prices.maximum);
  return {
    external_key, name, accommodation_type: text(hotel.accommodation_type), url: text(hotel.url),
    rating: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
    review_count: count !== null && Number.isInteger(count) && count >= 0 && count <= 2147483647 ? count : null,
    min_price: min !== null && min >= 0 && min < 1e12 ? min : null,
    max_price: max !== null && max >= 0 && max < 1e12 ? max : null,
    latitude: lat !== null && Math.abs(lat) <= 90 ? lat : null,
    longitude: lon !== null && Math.abs(lon) <= 180 ? lon : null,
    image: text(hotel.image), mentions: Array.isArray(hotel.mentions) ? hotel.mentions : [],
    merchandising_labels: Array.isArray(hotel.merchandising_labels) ? hotel.merchandising_labels : [],
    raw_payload: hotel,
  };
}

export async function fetchCompetitors(locationKey: string, fetcher: typeof fetch = fetch) {
  const records = new Map<string, ReturnType<typeof normalizeCompetitor>>();
  let fetched = 0;
  for (let offset = 0; offset < 2500; offset += 50) {
    const url = new URL("https://data.xotelo.com/api/list");
    url.search = new URLSearchParams({ location_key: locationKey, offset: String(offset), limit: "50", sort: "best_value" }).toString();
    const response = await fetcher(url, { signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "QualityFriend/1.0", Accept: "application/json" } });
    if (!response.ok) throw new Error(`Xotelo request failed (HTTP ${response.status}).`);
    const data = object(await response.json());
    if (data.error) {
      const message = text(data.error) ?? text(object(data.error).message) ?? "Unknown provider error";
      throw new Error(`Xotelo returned an API error: ${message.slice(0, 200)}`);
    }
    const list = object(data.result).list;
    if (!Array.isArray(list) || list.length > 50) throw new Error("Xotelo returned an invalid hotel list.");
    for (const item of list) {
      const record = normalizeCompetitor(item);
      records.set(record.external_key, record);
    }
    fetched += list.length;
    if (list.length < 50) break;
  }
  return { records: [...records.values()], capped: fetched >= 2500 };
}
