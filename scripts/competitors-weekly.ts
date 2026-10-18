import "dotenv/config";
import { syncAllHotelCompetitors } from "../lib/competitors/sync";
import { createJobPrisma } from "../lib/jobs/prisma";

async function main() {
  const prisma = createJobPrisma(2);
  try {
    // Optional hotel UUID: npm run competitors:weekly -- <hotel-uuid>
    // No argument processes every active hotel and reports missing Tripadvisor IDs as skipped.
    const requestedHotelId = process.argv[2];
    const results = await syncAllHotelCompetitors(prisma, requestedHotelId);

    for (const result of results) console.log(JSON.stringify(result));

    const failed = results.filter((result) => !result.ok).length;
    const skipped = results.filter((result) => result.skipped).length;
    const upserted = results.reduce((total, result) => total + (result.upserted ?? 0), 0);
    console.log(JSON.stringify({ hotels: results.length, failed, skipped, upserted }));

    if (failed) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
