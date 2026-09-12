import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { Pool } from "pg";
import { fetchCompetitors, normalizeCompetitor } from "../lib/competitors/provider";
import { refreshCompetitors } from "../lib/competitors/jobs";

const hotel = { key: "g1-d1", name: "Test hotel", review_summary: { rating: 4.5, count: 20 },
  price_ranges: { minimum: 100, maximum: 150 }, geo: { latitude: 0, longitude: 11 }, mentions: ["Lake view"] };
const response = (list: unknown[]) => new Response(JSON.stringify({ result: { list }, error: null }));
function provider(list: unknown[]): typeof fetch { return async () => response(list); }

test("normalizes provider fields, keeps raw data, and preserves valid zero coordinates", () => {
  const value = normalizeCompetitor(hotel);
  assert.equal(value.external_key, hotel.key);
  assert.equal(value.latitude, 0);
  assert.equal(value.rating, 4.5);
  assert.equal(value.raw_payload, hotel);
  assert.equal(normalizeCompetitor({ key: "x", name: "No values" }).min_price, null);
  assert.throws(() => normalizeCompetitor({ name: "Missing key" }));
});

test("paginates in batches of 50, preserves location, and deduplicates hotel keys", async () => {
  const offsets: string[] = [];
  const result = await fetchCompetitors("g1493734", async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("location_key"), "g1493734");
    assert.equal(url.searchParams.get("sort"), "best_value");
    offsets.push(url.searchParams.get("offset")!);
    return offsets.length === 1 ? response(Array.from({ length: 50 }, (_, i) => ({ ...hotel, key: `key-${i}` })))
      : response([{ ...hotel, key: "key-0", name: "Latest name" }]);
  });
  assert.deepEqual(offsets, ["0", "50"]);
  assert.equal(result.records.length, 50);
  assert.equal(result.records[0].name, "Latest name");
  assert.equal(result.capped, false);
});

test("rejects HTTP failures, API errors, and malformed lists", async () => {
  await assert.rejects(fetchCompetitors("g1", async () => new Response("", { status: 503 })), /HTTP 503/);
  await assert.rejects(fetchCompetitors("g1", async () => new Response(JSON.stringify({ error: "invalid location" }))), /API error/);
  await assert.rejects(fetchCompetitors("g1", async () => new Response("{}")), /invalid hotel list/);
});

test("caps a full provider result at 2500 hotels", async () => {
  let calls = 0;
  const result = await fetchCompetitors("g1", async () => {
    const page = calls++;
    return response(Array.from({ length: 50 }, (_, index) => ({ ...hotel, key: `${page}-${index}` })));
  });
  assert.equal(calls, 50);
  assert.equal(result.records.length, 2500);
  assert.equal(result.capped, true);
});

test("PostgreSQL: upserts, tenant isolation, failure atomicity, and stale jobs", { skip: process.env.RUN_COMPETITOR_DB_TESTS !== "1" }, async () => {
  const schema = `competitor_test_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: process.env.DATABASE_URL });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},public` });
  const first = randomUUID(), second = randomUUID();
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await pool.query("CREATE TABLE hotel_tenants (id uuid PRIMARY KEY, tripadvisor_id text, is_active boolean DEFAULT true)");
    await pool.query(await readFile("prisma/migrations/20260912090000_add_competitors/migration.sql", "utf8"));
    await pool.query("INSERT INTO hotel_tenants (id, tripadvisor_id) VALUES ($1, 'g1'), ($2, 'g1')", [first, second]);
    const firstJob = { hotelTenantId: first, locationKey: "g1" };
    await refreshCompetitors(pool, firstJob, provider([hotel]));
    await refreshCompetitors(pool, { hotelTenantId: second, locationKey: "g1" }, provider([hotel]));
    const original = (await pool.query("SELECT id FROM competitors WHERE hotel_tenant_id = $1", [first])).rows[0];
    await refreshCompetitors(pool, firstJob, provider([{ ...hotel, name: "Updated", price_ranges: { minimum: 222 } }]));
    const rows = (await pool.query("SELECT * FROM competitors ORDER BY name")).rows;
    assert.equal(rows.length, 2);
    assert.equal(rows.find((row) => row.hotel_tenant_id === first).id, original.id);
    assert.equal(rows.find((row) => row.hotel_tenant_id === first).min_price, "222.00");
    assert.equal(rows.find((row) => row.hotel_tenant_id === second).name, "Test hotel");

    let pages = 0;
    await assert.rejects(refreshCompetitors(pool, firstJob, async () => {
      if (pages++ === 0) return response(Array.from({ length: 50 }, (_, i) => ({ ...hotel, key: `new-${i}` })));
      return new Response("", { status: 500 });
    }));
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM competitors")).rows[0].count, 2);

    await pool.query("UPDATE hotel_tenants SET tripadvisor_id = 'g2' WHERE id = $1", [first]);
    const skipped = await refreshCompetitors(pool, firstJob, async () => { throw new Error("Must not fetch stale location"); });
    assert.ok("skipped" in skipped);
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
