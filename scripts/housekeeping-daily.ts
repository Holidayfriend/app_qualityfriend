import "dotenv/config";
import { Pool } from "pg";
import { generateHotelDailyPlan, hotelLocalDate } from "../lib/housekeeping/daily-plan";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
  try {
    // Run without an argument to prepare every active hotel. Pass a hotel UUID
    // to rebuild only that hotel's current local day while debugging.
    const requestedHotel = process.argv[2];
    const result = await pool.query<{ id: string; time_zone: string | null }>(`SELECT id,time_zone FROM hotel_tenants WHERE is_active=true ${requestedHotel ? "AND id=$1" : ""}`, requestedHotel ? [requestedHotel] : []);
    for (const hotel of result.rows) {
      // Each hotel gets its own local work date. Generation is idempotent, keeps
      // historical days, copies permanent assignments, and leaves today-only
      // assignments out of future days.
      const workDate = hotelLocalDate(hotel.time_zone?.trim() || "UTC");
      const counts = await generateHotelDailyPlan(pool, hotel.id, workDate);
      console.log(JSON.stringify({ hotelTenantId: hotel.id, workDate, ...counts }));
    }
  } finally { await pool.end(); }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
