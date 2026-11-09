import "dotenv/config";
import { generateHotelDailyPlan, hotelLocalDate } from "../lib/housekeeping/daily-plan";
import { createJobPrisma } from "../lib/jobs/prisma";

async function main() {
  // Script-safe Prisma (not lib/prisma.ts — that uses server-only)
  const prisma = createJobPrisma(2);
  try {
    // Optional CLI arg: hotel UUID. Example: npm run housekeeping:daily -- <hotel-uuid>
    // No arg = process every active hotel; with arg = only that hotel (useful for debugging).
    const requestedHotel = process.argv[2];

    const hotels = await prisma.hotelTenant.findMany({
      where: {
        isActive: true,
        ...(requestedHotel ? { id: requestedHotel } : {}),
      },
      select: { id: true, timeZone: true },
    });

    for (const hotel of hotels) {
      // "Today" for this hotel as YYYY-MM-DD in the hotel's own time zone
      // (falls back to UTC if timeZone is missing/blank). Hotels in different
      // zones can therefore get different calendar dates at the same moment.
      const workDate = hotelLocalDate(hotel.timeZone?.trim() || "UTC");

      // Build/refresh that hotel's housekeeping plan for workDate.
      // Safe to re-run the same day (idempotent); returns summary counts for logging.
      const counts = await generateHotelDailyPlan(prisma, hotel.id, workDate);

      // One JSON line per hotel so cron/logs are easy to scan
      console.log(JSON.stringify({ hotelTenantId: hotel.id, workDate, ...counts }));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
