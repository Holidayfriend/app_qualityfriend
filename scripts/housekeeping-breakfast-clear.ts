import "dotenv/config";
import { createJobPrisma } from "../lib/jobs/prisma";

async function main() {
  const requestedHotel = process.argv[2];
  if (process.argv.length > 3 || (requestedHotel && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedHotel))) {
    throw new Error("Usage: npm run housekeeping:breakfast-clear -- [hotel-uuid]");
  }
  const prisma = createJobPrisma(2);
  try {
    const where = { breakfastInRoom: true, ...(requestedHotel ? { hotelTenantId: requestedHotel } : {}) };
    const hotels = await prisma.roomOperationalState.groupBy({ by: ["hotelTenantId"], where, _count: { _all: true } });
    const cleared = await prisma.roomOperationalState.updateMany({ where, data: { breakfastInRoom: false } });
    for (const hotel of hotels) console.log(JSON.stringify({ hotelTenantId: hotel.hotelTenantId, cleared: hotel._count._all }));
    console.log(JSON.stringify({ hotels: hotels.length, cleared: cleared.count }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
