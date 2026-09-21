import "dotenv/config";
import { Pool } from "pg";
import { importHousekeeping, recordImportFailure, importFailureReason } from "../lib/housekeeping/import-job";
import type { HousekeepingImportJob } from "../lib/jobs/queue";
import { createJobPrisma } from "../lib/jobs/prisma";
import { createJobQueue, initializeQueues, queues, type HousekeepingAiAllocateJob, type ManualIndexJob, type RecruitingAiScoreJob, type SmokeJob } from "../lib/jobs/queue";
import { indexManualDocument } from "../lib/manuals/index-job";
import { generateAllHotelAiRecommendations } from "../lib/ai/daily-recommendations";
import { runHousekeepingAiAllocation } from "../lib/housekeeping/ai-allocate";
import { scoreRecruitingApplication } from "../lib/recruiting/ai-score-job";
import { spawnAllHotelChecklists } from "../lib/checklists/spawn";
import { syncAllHotelWeather } from "../lib/weather/sync";

const boss = createJobQueue(true);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
let stopping = false;

async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("[worker] Stopping; waiting for active jobs.");
  await boss.stop({ graceful: true, timeout: 30_000 });
  await pool.end();
}

async function main() {
  await boss.start();
  await initializeQueues(boss);
  // Includes terminal queue failures/timeouts that never reached the handler's catch block.
  await boss.work<HousekeepingImportJob>(queues.housekeepingFailed, async ([job]) => {
    await recordImportFailure(pool, job.data, true);
  });
  await boss.work<HousekeepingImportJob, unknown, { includeMetadata: true }>(queues.housekeeping, { includeMetadata: true }, async ([job]) => {
    try {
      const result = await importHousekeeping(pool, job.data, job.signal);
      console.log(`[worker] Housekeeping import ${job.id} completed`, result);
      return result;
    } catch (error) {
      // Do not log guest data or SQL parameter values.
      const reason = importFailureReason(error);
      console.error(`[worker] Housekeeping import ${job.id} attempt ${job.retryCount + 1} failed: ${reason}`);
      await recordImportFailure(pool, job.data, job.retryCount >= job.retryLimit, reason);
      throw new Error(reason);
    }
  });
  await boss.work<SmokeJob>(queues.smoke, async ([job]) => {
    if (typeof job.data.message !== "string") throw new Error("Invalid smoke job payload.");
    console.log(`[worker] Completed smoke job ${job.id}`);
    return { message: job.data.message, processedAt: new Date().toISOString() };
  });
  await boss.work<ManualIndexJob>(queues.manualIndex, async ([job]) => {
    if (!job.data?.hotelTenantId || !job.data?.documentId) throw new Error("Invalid manual index payload.");
    const result = await indexManualDocument(job.data);
    console.log(`[worker] Manual index ${job.id} completed`, result);
    return result;
  });
  await boss.work<RecruitingAiScoreJob>(queues.recruitingAiScore, async ([job]) => {
    if (!job.data?.hotelTenantId || !job.data?.applicationId) throw new Error("Invalid recruiting AI score payload.");
    const result = await scoreRecruitingApplication(job.data);
    console.log(`[worker] Recruiting AI score ${job.id} completed`, result);
    return result;
  });
  await boss.work<HousekeepingAiAllocateJob>(queues.housekeepingAiAllocate, async ([job]) => {
    if (!job.data?.hotelTenantId || typeof job.data.timeZone !== "string") throw new Error("Invalid housekeeping AI allocate payload.");
    const prisma = createJobPrisma(2);
    try {
      const result = await runHousekeepingAiAllocation(prisma, job.data.hotelTenantId, job.data.timeZone);
      console.log(`[worker] Housekeeping AI allocate ${job.id} completed`, result);
      return result;
    } finally {
      await prisma.$disconnect();
    }
  });
  await boss.schedule(queues.checklistsDaily, "0 6 * * *", {}, { tz: "UTC", singletonKey: "checklists-daily", singletonSeconds: 3600 });
  await boss.work(queues.checklistsDaily, async () => {
    const prisma = createJobPrisma(2);
    try {
      const results = await spawnAllHotelChecklists(prisma);
      console.log(`[worker] Checklists daily completed`, { hotels: results.filter((item) => item.ok).length, failed: results.filter((item) => item.ok === false).length });
      return { hotels: results.length };
    } finally {
      await prisma.$disconnect();
    }
  });
  await boss.schedule(queues.weatherDaily, "0 6,14 * * *", {}, { tz: "UTC", singletonKey: "weather-daily", singletonSeconds: 3600 });
  await boss.work(queues.weatherDaily, async () => {
    const prisma = createJobPrisma(2);
    try {
      const results = await syncAllHotelWeather(prisma);
      console.log(`[worker] Weather daily completed`, { hotels: results.length, failed: results.filter((item) => item.ok === false).length });
      return { hotels: results.length };
    } finally {
      await prisma.$disconnect();
    }
  });
  await boss.schedule(queues.aiRecommendationDaily, "0 6 * * *", {}, { tz: "UTC", singletonKey: "ai-recommendation-daily", singletonSeconds: 3600 });
  await boss.work(queues.aiRecommendationDaily, async () => {
    const prisma = createJobPrisma(2);
    try {
      const results = await generateAllHotelAiRecommendations(prisma);
      console.log(`[worker] AI recommendation daily completed`, { items: results.length, failed: results.filter((item) => item.ok === false).length });
      return { items: results.length };
    } finally {
      await prisma.$disconnect();
    }
  });
  console.log("[worker] Ready and waiting for jobs.");
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => {
      shutdown().catch((error) => {
        console.error("[worker] Shutdown failed", error);
        process.exitCode = 1;
      });
    });
  }
}

main().catch(async (error) => {
  console.error("[worker] Startup failed", error);
  process.exitCode = 1;
  await shutdown();
});
