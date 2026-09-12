import type { Pool } from "pg";
import type { CompetitorRefreshJob } from "../jobs/queue";
import { fetchCompetitors } from "./provider";

export async function refreshCompetitors(pool: Pool, data: CompetitorRefreshJob, fetcher: typeof fetch = fetch) {
  const hotel = await pool.query("SELECT tripadvisor_id FROM hotel_tenants WHERE id = $1 AND is_active = true", [data.hotelTenantId]);
  if (!hotel.rows[0] || hotel.rows[0].tripadvisor_id?.trim() !== data.locationKey) return { skipped: "Hotel or Tripadvisor ID changed." };
  const { records, capped } = await fetchCompetitors(data.locationKey, fetcher);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
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
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, image = EXCLUDED.image,
        mentions = EXCLUDED.mentions, merchandising_labels = EXCLUDED.merchandising_labels,
        raw_payload = EXCLUDED.raw_payload, last_fetched_at = EXCLUDED.last_fetched_at, updated_at = NOW()
    `, [data.hotelTenantId, data.locationKey, JSON.stringify(records)]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return { saved: records.length, capped, completedAt: new Date().toISOString() };
}
