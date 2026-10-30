import { createJobPrisma } from "../jobs/prisma";
import type { RecruitingAiScoreJob } from "../jobs/queue";
import { scoreRecruitingApplicationCached } from "./score-application";

export async function scoreRecruitingApplication(data: RecruitingAiScoreJob) {
  const prisma = createJobPrisma(2);
  try {
    return await scoreRecruitingApplicationCached(prisma, data.hotelTenantId, data.applicationId);
  } finally {
    await prisma.$disconnect();
  }
}
