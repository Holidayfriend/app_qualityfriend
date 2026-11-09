import "dotenv/config";
import { createJobPrisma } from "../lib/jobs/prisma";
import { generateAllHotelForecastTables } from "../lib/revenue/refresh";

async function main() {
  const prisma = createJobPrisma(2);
  try {
    const requestedHotel = process.argv[2];
    if (process.argv.length > 3 || (requestedHotel && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedHotel))) {
      throw new Error("Usage: npm run revenue:daily -- [hotel-uuid]");
    }
    const results = await generateAllHotelForecastTables(prisma, requestedHotel);
    for (const result of results) console.log(JSON.stringify(result));
    if (!results.length || results.some((result) => result.ok === false)) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
