import "dotenv/config";
import { createJobPrisma } from "../lib/jobs/prisma";
import { syncAllHotelWeather } from "../lib/weather/sync";

async function main() {
  // Script-safe Prisma (not lib/prisma.ts — that uses server-only)
  const prisma = createJobPrisma(2);
  try {
    // Optional CLI arg: hotel UUID. Example: npm run weather:daily -- <hotel-uuid>
    // No arg = process every active hotel; with arg = only that hotel (useful for debugging).
    const requestedHotel = process.argv[2];
    const results = await syncAllHotelWeather(prisma, requestedHotel);

    for (const result of results) {
      console.log(JSON.stringify(result));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
