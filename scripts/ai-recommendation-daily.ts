import "dotenv/config";
import { createJobPrisma } from "../lib/jobs/prisma";
import { generateAllHotelAiRecommendations } from "../lib/ai/daily-recommendations";

async function main() {
  const prisma = createJobPrisma(2);
  try {
    const requestedHotel = process.argv[2];
    const results = await generateAllHotelAiRecommendations(prisma, requestedHotel);
    for (const result of results) {
      console.log(JSON.stringify(result));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
