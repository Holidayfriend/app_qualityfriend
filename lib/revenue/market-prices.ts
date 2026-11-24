import type { PrismaClient } from "../../app/generated/prisma/client";

export const OWN_HOTEL_PREFIX = "[OWN HOTEL] ";

function num(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function mean(values: Array<number | null | undefined>) {
  const amounts = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!amounts.length) return null;
  return round2(amounts.reduce((sum, value) => sum + value, 0) / amounts.length);
}

// A competitor's saved per-date prices (written by "Update prices") -> ADR per date.
// Older rows only hold one price per date, which is used as both min and max.
export function dailyFromMentions(mentions: unknown, dates: Set<string>) {
  const result = new Map<string, number>();
  if (!Array.isArray(mentions)) return result;
  for (const entry of mentions) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as { date?: unknown; price?: unknown; minPrice?: unknown; maxPrice?: unknown };
    if (typeof item.date !== "string" || !dates.has(item.date)) continue;
    const min = num(item.minPrice ?? item.price);
    const max = num(item.maxPrice ?? item.price);
    const adr = mean([min, max]);
    if (adr !== null && adr > 0) result.set(item.date, adr);
  }
  return result;
}

// Our price for one night: the average over the room categories, weighted by how many rooms each has.
export function weightedPrice(items: Array<{ price: number | null; weight: number }>) {
  const priced = items.filter((item): item is { price: number; weight: number } => item.price !== null);
  if (!priced.length) return null;
  const weights = priced.map((item) => (item.weight > 0 ? item.weight : 1));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return round2(priced.reduce((sum, item, index) => sum + item.price * weights[index], 0) / total);
}

export function competitorsOnDate(competitors: Array<{ days: Map<string, number> }>, date: string) {
  const prices = competitors.flatMap((competitor) => {
    const price = competitor.days.get(date);
    return price === undefined ? [] : [price];
  });
  if (!prices.length) return { avg: null, low: null, high: null, count: 0 };
  return { avg: mean(prices), low: Math.min(...prices), high: Math.max(...prices), count: prices.length };
}

export type DayMarket = {
  own: number | null;
  competitorAvg: number | null;
  competitorLow: number | null;
  competitorHigh: number | null;
  competitorCount: number;
};

export type MarketPrices = {
  hasOwn: boolean;
  hasCompetitors: boolean;
  days: Map<string, DayMarket>;
  // Our average price per room category over the dates (EZ has no 2-person price, so its 1-person price is used).
  categories: Map<string, number>;
  competitorAverage: number | null;
  competitors: Array<{ name: string; distanceKm: number | null; rating: number | null; reviewCount: number | null; averageRate: number | null; daysWithPrice: number }>;
};

// Our imported prices (own_room_rates) and the competitors' per-date prices for the given dates.
export async function loadMarketPrices(prisma: PrismaClient, hotelTenantId: string, dates: string[]): Promise<MarketPrices> {
  const dateSet = new Set(dates);
  const first = new Date(`${dates[0]}T00:00:00.000Z`);
  const last = new Date(`${dates[dates.length - 1]}T00:00:00.000Z`);
  const [settings, rates, roomCounts] = await Promise.all([
    prisma.competitorSettings.findUnique({ where: { hotelTenantId }, select: { locationCode: true } }),
    prisma.ownRoomRate.findMany({
      where: { hotelTenantId, rateDate: { gte: first, lte: last } },
      select: { categoryId: true, rateDate: true, roomPrice2Adults: true, pricePerPerson1: true },
    }),
    prisma.room.groupBy({ by: ["categoryId"], where: { hotelTenantId, isActive: true, archivedAt: null }, _count: { _all: true } }),
  ]);
  const rooms = new Map(roomCounts.flatMap((row) => (row.categoryId ? [[row.categoryId, row._count._all] as const] : [])));

  const rows = settings?.locationCode == null ? [] : await prisma.competitor.findMany({
    where: { hotelTenantId, locationKey: String(settings.locationCode) },
    select: { name: true, mentions: true, rating: true, reviewCount: true, rawPayload: true },
  });
  const competitors = rows.filter((row) => !row.name.startsWith(OWN_HOTEL_PREFIX)).map((row) => ({
    name: row.name,
    rating: row.rating,
    reviewCount: row.reviewCount,
    distanceKm: row.rawPayload && typeof row.rawPayload === "object" && !Array.isArray(row.rawPayload) ? num((row.rawPayload as { distKm?: unknown }).distKm) : null,
    days: dailyFromMentions(row.mentions, dateSet),
  }));

  const ownByDate = new Map<string, Array<{ price: number | null; weight: number }>>();
  const byCategory = new Map<string, number[]>();
  for (const rate of rates) {
    const date = rate.rateDate.toISOString().slice(0, 10);
    const room2 = num(rate.roomPrice2Adults);
    const list = ownByDate.get(date) ?? [];
    list.push({ price: room2, weight: rooms.get(rate.categoryId) ?? 1 });
    ownByDate.set(date, list);
    const single = num(rate.pricePerPerson1);
    const price = room2 ?? single;
    if (price !== null) byCategory.set(rate.categoryId, [...(byCategory.get(rate.categoryId) ?? []), price]);
  }

  const days = new Map<string, DayMarket>();
  for (const date of dates) {
    const market = competitorsOnDate(competitors, date);
    days.set(date, {
      own: weightedPrice(ownByDate.get(date) ?? []),
      competitorAvg: market.avg,
      competitorLow: market.low,
      competitorHigh: market.high,
      competitorCount: market.count,
    });
  }
  const values = [...days.values()];
  return {
    hasOwn: values.some((day) => day.own !== null),
    hasCompetitors: values.some((day) => day.competitorCount > 0),
    days,
    categories: new Map([...byCategory.entries()].flatMap(([id, prices]) => { const average = mean(prices); return average === null ? [] : [[id, average] as const]; })),
    competitorAverage: mean(values.map((day) => day.competitorAvg)),
    competitors: competitors.map((competitor) => ({
      name: competitor.name,
      distanceKm: competitor.distanceKm,
      rating: competitor.rating,
      reviewCount: competitor.reviewCount,
      averageRate: mean([...competitor.days.values()]),
      daysWithPrice: competitor.days.size,
    })).filter((competitor) => competitor.daysWithPrice > 0),
  };
}
