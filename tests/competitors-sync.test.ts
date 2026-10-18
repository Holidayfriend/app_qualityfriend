import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../app/generated/prisma/client";
import { mapXoteloCompetitor, syncAllHotelCompetitors } from "../lib/competitors/sync";

test("maps a Xotelo hotel into competitor fields", () => {
  const record = mapXoteloCompetitor({
    key: "g123-d456",
    name: "Example Hotel",
    accommodation_type: "Hotel",
    url: "https://example.test/hotel",
    review_summary: { rating: 4.7, count: 321 },
    price_ranges: { minimum: 120, maximum: 240 },
    geo: { latitude: 46.5, longitude: 11.4 },
    image: "https://example.test/image.jpg",
    mentions: ["Family"],
    merchandising_labels: ["Breakfast included"],
  }, 27);

  assert.ok(record);
  assert.equal(record.externalKey, "g123-d456");
  assert.equal(record.bestValueRank, 27);
  assert.equal(record.rating, 4.7);
  assert.equal(record.reviewCount, 321);
  assert.equal(record.latitude, 46.5);
  assert.deepEqual(record.mentions, ["Family"]);
});

test("skips an active hotel when its Tripadvisor ID is missing", async () => {
  const prisma = {
    hotelTenant: {
      findMany: async () => [{ id: "hotel-without-key", tripadvisorId: null }],
    },
  } as unknown as PrismaClient;

  const results = await syncAllHotelCompetitors(prisma);
  assert.deepEqual(results, [{
    hotelTenantId: "hotel-without-key",
    locationKey: null,
    ok: true,
    skipped: true,
    reason: "MISSING_TRIPADVISOR_ID",
  }]);
});

test("downloads and upserts competitors for a configured hotel", async () => {
  const originalFetch = globalThis.fetch;
  const upserts: Array<Record<string, unknown>> = [];
  const requestedOffsets: number[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("location_key"), "g123");
    assert.equal(url.searchParams.get("limit"), "100");
    const offset = Number(url.searchParams.get("offset"));
    requestedOffsets.push(offset);
    const list = offset === 0
      ? Array.from({ length: 99 }, (_, index) => ({
          key: `g123-d${index + 1}`,
          name: `Example Hotel ${index + 1}`,
          mentions: [],
          merchandising_labels: [],
        }))
      : [
          { key: "g123-d101", name: "Example Hotel 101", mentions: [], merchandising_labels: [] },
          { key: "g123-d102", name: "Example Hotel 102", mentions: [], merchandising_labels: [] },
        ];
    return new Response(JSON.stringify({
      error: null,
      result: {
        total_count: 102,
        limit: 100,
        offset,
        list,
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  const prisma = {
    hotelTenant: {
      findMany: async () => [{ id: "hotel-1", tripadvisorId: " g123 " }],
    },
    competitor: {
      upsert: (args: Record<string, unknown>) => {
        upserts.push(args);
        return Promise.resolve({});
      },
    },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  } as unknown as PrismaClient;

  try {
    const results = await syncAllHotelCompetitors(prisma);
    assert.equal(results[0]?.ok, true);
    assert.equal(results[0]?.upserted, 101);
    assert.equal(upserts.length, 101);
    assert.deepEqual(requestedOffsets, [0, 100]);
    assert.equal((upserts[0]?.create as Record<string, unknown>).bestValueRank, 1);
    assert.equal((upserts[0]?.update as Record<string, unknown>).bestValueRank, 1);
    assert.deepEqual((upserts[0]?.where as Record<string, unknown>).hotelTenantId_locationKey_externalKey, {
      hotelTenantId: "hotel-1",
      locationKey: "g123",
      externalKey: "g123-d1",
    });
    assert.equal((upserts[98]?.create as Record<string, unknown>).bestValueRank, 99);
    assert.equal((upserts[99]?.create as Record<string, unknown>).bestValueRank, 101);
    assert.equal((upserts[100]?.create as Record<string, unknown>).bestValueRank, 102);
    assert.equal((upserts[100]?.update as Record<string, unknown>).bestValueRank, 102);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
