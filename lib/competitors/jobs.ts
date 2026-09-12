import { setTimeout as delay } from "node:timers/promises";
import type { Pool } from "pg";
import type { PgBoss } from "pg-boss";
import { queues, type CompetitorAddressJob, type CompetitorRefreshJob } from "../jobs/queue";
import { compactAddress, fetchCompetitors } from "./provider";

export async function refreshCompetitors(pool: Pool, boss: Pick<PgBoss, "send">, data: CompetitorRefreshJob, fetcher: typeof fetch = fetch) {
  const hotel = await pool.query("SELECT tripadvisor_id FROM hotel_tenants WHERE id = $1 AND is_active = true", [data.hotelTenantId]);
  if (!hotel.rows[0] || hotel.rows[0].tripadvisor_id?.trim() !== data.locationKey) return { skipped: "Hotel or Tripadvisor ID changed." };
  const { records, capped } = await fetchCompetitors(data.locationKey, fetcher);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Hold the hotel row while committing, so settings cannot change mid-write.
    const current = await client.query("SELECT tripadvisor_id FROM hotel_tenants WHERE id = $1 AND is_active = true FOR SHARE", [data.hotelTenantId]);
    if (current.rows[0]?.tripadvisor_id?.trim() !== data.locationKey) {
      await client.query("ROLLBACK");
      return { skipped: "Tripadvisor ID changed during refresh." };
    }
    await client.query(`
      INSERT INTO competitors (id, hotel_tenant_id, location_key, external_key, name, accommodation_type,
        url, rating, review_count, min_price, max_price, latitude, longitude, image, mentions,
        merchandising_labels, raw_payload, last_fetched_at, updated_at)
      SELECT gen_random_uuid(), $1, $2, r.external_key, r.name, r.accommodation_type, r.url, r.rating,
        r.review_count, r.min_price, r.max_price, r.latitude, r.longitude, r.image, r.mentions,
        r.merchandising_labels, r.raw_payload, NOW(), NOW()
      FROM jsonb_to_recordset($3::jsonb) AS r(external_key text, name text, accommodation_type text,
        url text, rating float8, review_count int, min_price numeric, max_price numeric,
        latitude float8, longitude float8, image text, mentions jsonb, merchandising_labels jsonb, raw_payload jsonb)
      ON CONFLICT (hotel_tenant_id, location_key, external_key) DO UPDATE SET
        name = EXCLUDED.name, accommodation_type = EXCLUDED.accommodation_type, url = EXCLUDED.url,
        rating = EXCLUDED.rating, review_count = EXCLUDED.review_count,
        min_price = EXCLUDED.min_price, max_price = EXCLUDED.max_price,
        hotel_address = CASE WHEN competitors.latitude IS DISTINCT FROM EXCLUDED.latitude
          OR competitors.longitude IS DISTINCT FROM EXCLUDED.longitude THEN NULL ELSE competitors.hotel_address END,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, image = EXCLUDED.image,
        mentions = EXCLUDED.mentions, merchandising_labels = EXCLUDED.merchandising_labels,
        raw_payload = EXCLUDED.raw_payload, last_fetched_at = EXCLUDED.last_fetched_at, updated_at = NOW()
    `, [data.hotelTenantId, data.locationKey, JSON.stringify(records)]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }

  const missing = await pool.query(`SELECT id FROM competitors WHERE hotel_tenant_id = $1 AND location_key = $2
    AND hotel_address IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL
    AND external_key = ANY($3::text[])`, [data.hotelTenantId, data.locationKey, records.map((record) => record.external_key)]);
  let addressesQueued = 0;
  for (const row of missing.rows) {
    const id = await boss.send(queues.addresses, { hotelTenantId: data.hotelTenantId, competitorId: row.id }, { singletonKey: row.id });
    if (id) addressesQueued++;
  }
  return { saved: records.length, capped, addressesQueued, completedAt: new Date().toISOString() };
}

export async function refreshCompetitorAddress(pool: Pool, data: CompetitorAddressJob, fetcher: typeof fetch = fetch) {
  const result = await pool.query(`SELECT c.latitude, c.longitude, c.hotel_address FROM competitors c
    JOIN hotel_tenants h ON h.id = c.hotel_tenant_id
    WHERE c.id = $1 AND c.hotel_tenant_id = $2 AND h.is_active = true AND c.location_key = trim(h.tripadvisor_id)`,
  [data.competitorId, data.hotelTenantId]);
  const row = result.rows[0];
  if (!row || row.hotel_address || row.latitude === null || row.longitude === null) return { skipped: true };
  const provider = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org/reverse";
  const key = `${provider}|${row.latitude},${row.longitude}`;
  const client = await pool.connect();
  let locked = false;
  try {
    // One geocoder request at a time across worker processes. Timestamp persists
    // even when a request fails or the process stops, preserving the rate limit.
    const lock = await client.query("SELECT pg_try_advisory_lock(716420, 1) AS acquired");
    locked = lock.rows[0].acquired;
    if (!locked) throw new Error("Address provider is busy; retrying later.");
    const cached = await client.query("SELECT address, completed_at FROM competitor_address_cache WHERE key = $1", [key]);
    let address: string | null;
    if (cached.rows[0]?.completed_at) {
      address = cached.rows[0].address;
    } else {
      const recent = await client.query(`SELECT GREATEST(0, 15000 - EXTRACT(EPOCH FROM (clock_timestamp() - MAX(requested_at))) * 1000) AS wait
        FROM competitor_address_cache WHERE provider = $1`, [provider]);
      await delay(Math.ceil(Number(recent.rows[0].wait) || 0));
      await client.query(`INSERT INTO competitor_address_cache (key, provider, requested_at)
        VALUES ($1, $2, clock_timestamp()) ON CONFLICT (key) DO UPDATE SET requested_at = clock_timestamp()`, [key, provider]);
      const url = new URL(provider);
      for (const [name, value] of Object.entries({ format: "json", lat: String(row.latitude), lon: String(row.longitude), zoom: "18", addressdetails: "1" })) url.searchParams.set(name, value);
      const response = await fetcher(url, {
        signal: AbortSignal.timeout(15_000),
        headers: { "User-Agent": process.env.NOMINATIM_USER_AGENT || "QualityFriend/1.0 (https://qualityfriend.solutions)", "Accept-Language": "en", Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Address lookup failed (HTTP ${response.status}).`);
      const payload = await response.json();
      if (!payload || typeof payload !== "object") throw new Error("Address provider returned an invalid response.");
      if (payload.error && payload.error !== "Unable to geocode") throw new Error("Address provider returned an API error.");
      address = compactAddress(payload);
      await client.query("UPDATE competitor_address_cache SET address = $2, payload = $3::jsonb, completed_at = clock_timestamp() WHERE key = $1", [key, address, JSON.stringify(payload)]);
    }
    // Do not attach an old address if a newer refresh has moved the coordinates.
    await client.query(`UPDATE competitors SET hotel_address = $3, updated_at = NOW()
      WHERE id = $1 AND hotel_tenant_id = $2 AND latitude = $4 AND longitude = $5 AND hotel_address IS NULL`,
    [data.competitorId, data.hotelTenantId, address, row.latitude, row.longitude]);
    return { addressFound: Boolean(address) };
  } finally {
    try { if (locked) await client.query("SELECT pg_advisory_unlock(716420, 1)"); }
    catch (error) { client.release(true); throw error; }
    client.release();
  }
}
