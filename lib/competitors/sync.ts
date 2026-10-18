import type { Prisma, PrismaClient } from "../../app/generated/prisma/client";

const XOTELO_LIST_URL = "https://data.xotelo.com/api/list";
const PAGE_SIZE = 100;
const MAX_RECORDS = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;

type JsonRecord = Record<string, unknown>;

type XoteloPage = {
  totalCount: number;
  hotels: JsonRecord[];
};

type CompetitorRecord = {
  bestValueRank: number;
  externalKey: string;
  name: string;
  accommodationType: string | null;
  url: string | null;
  rating: number | null;
  reviewCount: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  latitude: number | null;
  longitude: number | null;
  image: string | null;
  mentions: Prisma.InputJsonValue;
  merchandisingLabels: Prisma.InputJsonValue;
  rawPayload: Prisma.InputJsonValue;
};

export type CompetitorSyncResult = {
  hotelTenantId: string;
  locationKey: string | null;
  ok: boolean;
  skipped?: boolean;
  reason?: "MISSING_TRIPADVISOR_ID";
  fetched?: number;
  upserted?: number;
  rejected?: number;
  error?: string;
};

function object(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapXoteloCompetitor(value: unknown, bestValueRank = 1): CompetitorRecord | null {
  const hotel = object(value);
  if (!hotel) return null;

  const externalKey = text(hotel.key);
  const name = text(hotel.name);
  if (!externalKey || !name) return null;

  const reviewSummary = object(hotel.review_summary);
  const priceRanges = object(hotel.price_ranges);
  const geo = object(hotel.geo);
  const reviewCount = number(reviewSummary?.count);

  return {
    bestValueRank,
    externalKey,
    name,
    accommodationType: text(hotel.accommodation_type),
    url: text(hotel.url),
    rating: number(reviewSummary?.rating),
    reviewCount: reviewCount === null ? null : Math.max(0, Math.trunc(reviewCount)),
    minPrice: number(priceRanges?.minimum),
    maxPrice: number(priceRanges?.maximum),
    latitude: number(geo?.latitude),
    longitude: number(geo?.longitude),
    image: text(hotel.image),
    mentions: (Array.isArray(hotel.mentions) ? hotel.mentions : []) as Prisma.InputJsonValue,
    merchandisingLabels: (Array.isArray(hotel.merchandising_labels) ? hotel.merchandising_labels : []) as Prisma.InputJsonValue,
    rawPayload: hotel as Prisma.InputJsonValue,
  };
}

async function fetchXoteloPage(locationKey: string, offset: number): Promise<XoteloPage> {
  const url = new URL(XOTELO_LIST_URL);
  url.searchParams.set("location_key", locationKey);
  url.searchParams.set("offset", String(offset));
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("sort", "best_value");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "QualityFriend-competitors-weekly",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`Xotelo request failed (${response.status}).`);
  const payload = await response.json() as unknown;
  const root = object(payload);
  if (!root) throw new Error("Xotelo returned an invalid response.");

  const apiError = object(root.error);
  if (apiError) throw new Error(text(apiError.message) ?? "Xotelo returned an error.");

  const result = object(root.result);
  if (!result || !Array.isArray(result.list)) throw new Error("Xotelo response did not include a hotel list.");

  return {
    totalCount: Math.max(0, Math.trunc(number(result.total_count) ?? result.list.length)),
    hotels: result.list.filter((item): item is JsonRecord => object(item) !== null),
  };
}

export async function syncHotelCompetitors(
  prisma: PrismaClient,
  hotelTenantId: string,
  locationKey: string,
) {
  let offset = 0;
  let fetched = 0;
  let upserted = 0;
  let rejected = 0;

  while (offset < MAX_RECORDS) {
    const page = await fetchXoteloPage(locationKey, offset);
    const targetCount = Math.min(page.totalCount, MAX_RECORDS);
    if (page.hotels.length === 0) {
      if (offset < targetCount) throw new Error(`Xotelo returned an empty page at offset ${offset} of ${page.totalCount}.`);
      break;
    }

    const records = page.hotels
      .map((hotel, index) => mapXoteloCompetitor(hotel, offset + index + 1))
      .filter((record): record is CompetitorRecord => record !== null);
    rejected += page.hotels.length - records.length;
    const fetchedAt = new Date();

    if (records.length) {
      await prisma.$transaction(records.map((record) => prisma.competitor.upsert({
        where: {
          hotelTenantId_locationKey_externalKey: {
            hotelTenantId,
            locationKey,
            externalKey: record.externalKey,
          },
        },
        create: {
          hotelTenantId,
          locationKey,
          ...record,
          lastFetchedAt: fetchedAt,
        },
        update: {
          name: record.name,
          bestValueRank: record.bestValueRank,
          accommodationType: record.accommodationType,
          url: record.url,
          rating: record.rating,
          reviewCount: record.reviewCount,
          minPrice: record.minPrice,
          maxPrice: record.maxPrice,
          latitude: record.latitude,
          longitude: record.longitude,
          image: record.image,
          mentions: record.mentions,
          merchandisingLabels: record.merchandisingLabels,
          rawPayload: record.rawPayload,
          lastFetchedAt: fetchedAt,
        },
      })));
      upserted += records.length;
    }

    fetched += page.hotels.length;
    const nextOffset = offset + PAGE_SIZE;
    if (nextOffset >= targetCount) break;
    offset = nextOffset;
  }

  return { fetched, upserted, rejected };
}

export async function syncAllHotelCompetitors(prisma: PrismaClient, requestedHotelId?: string): Promise<CompetitorSyncResult[]> {
  const hotels = await prisma.hotelTenant.findMany({
    where: {
      isActive: true,
      ...(requestedHotelId ? { id: requestedHotelId } : {}),
    },
    select: { id: true, tripadvisorId: true },
    orderBy: { id: "asc" },
  });

  if (requestedHotelId && hotels.length === 0) throw new Error(`Active hotel not found: ${requestedHotelId}`);

  const results: CompetitorSyncResult[] = [];
  for (const hotel of hotels) {
    const locationKey = hotel.tripadvisorId?.trim();
    if (!locationKey) {
      results.push({
        hotelTenantId: hotel.id,
        locationKey: null,
        ok: true,
        skipped: true,
        reason: "MISSING_TRIPADVISOR_ID",
      });
      continue;
    }

    try {
      const counts = await syncHotelCompetitors(prisma, hotel.id, locationKey);
      results.push({ hotelTenantId: hotel.id, locationKey, ok: true, ...counts });
    } catch (error) {
      results.push({
        hotelTenantId: hotel.id,
        locationKey,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}
