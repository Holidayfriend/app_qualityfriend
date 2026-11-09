import "dotenv/config";
import { Pool } from "pg";
import { importHousekeeping, recordImportFailure, importFailureReason } from "../lib/housekeeping/import-job";
import { importHotelForecast } from "../lib/forecast/import-job";
import { createJobPrisma } from "../lib/jobs/prisma";
import { createJobQueue, initializeQueues, queues, type ForecastImportJob, type HotelWelcomeJob, type HousekeepingAiAllocateJob, type HousekeepingImportJob, type ManualIndexJob, type RecruitingAiScoreJob, type SmokeJob, type UserWelcomeJob } from "../lib/jobs/queue";
import { sendHotelWelcomeEmail, sendUserWelcomeEmail } from "../lib/users/welcome-email";
import { indexManualDocument } from "../lib/manuals/index-job";
import { generateAllHotelAiRecommendations } from "../lib/ai/daily-recommendations";
import { generateAllHotelForecastTables } from "../lib/revenue/refresh";
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
  await boss.work<ForecastImportJob, unknown, { includeMetadata: true }>(queues.forecastImport, { includeMetadata: true }, async ([job]) => {
    if (!job.data?.hotelTenantId || !job.data.xmlName || !job.data.runId || !job.data.sourceId) throw new Error("Invalid forecast import payload.");
    const prisma = createJobPrisma(2);
    const client = await pool.connect();
    try {
      await client.query(`UPDATE import_runs SET status='RUNNING',error_summary=NULL,updated_at=NOW() WHERE id=$1 AND hotel_tenant_id=$2 AND status NOT IN ('SUCCEEDED','FAILED')`, [job.data.runId, job.data.hotelTenantId]);
      const result = await importHotelForecast(prisma, job.data.hotelTenantId, job.data.xmlName);
      await client.query(`UPDATE import_runs SET status='SUCCEEDED',finished_at=NOW(),checksum=$3,records_read=$4,records_created=$5,records_rejected=$6,updated_at=NOW() WHERE id=$1 AND hotel_tenant_id=$2`, [job.data.runId, job.data.hotelTenantId, result.checksum, result.read, result.reservations, result.skippedRooms]);
      await client.query(`UPDATE hotel_import_sources SET last_successful_at=NOW(),updated_at=NOW() WHERE id=$1 AND hotel_tenant_id=$2`, [job.data.sourceId, job.data.hotelTenantId]);
      console.log(`[worker] Forecast import ${job.id} completed`, { reservations: result.reservations, rooms: result.rooms, guests: result.guests, skippedRooms: result.skippedRooms });
      return { reservations: result.reservations, rooms: result.rooms, guests: result.guests, skippedRooms: result.skippedRooms };
    } catch (error) {
      const reason = importFailureReason(error);
      const final = job.retryCount >= job.retryLimit;
      await client.query(`UPDATE import_runs SET status=$3::"ImportRunStatus",error_summary=$4,finished_at=CASE WHEN $5 THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$1 AND hotel_tenant_id=$2 AND status NOT IN ('SUCCEEDED','FAILED')`, [job.data.runId, job.data.hotelTenantId, final ? "FAILED" : "QUEUED", reason, final]);
      console.error(`[worker] Forecast import ${job.id} attempt ${job.retryCount + 1} failed: ${reason}`);
      throw new Error(reason);
    } finally {
      client.release();
      await prisma.$disconnect();
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
  await boss.work<UserWelcomeJob>(queues.userWelcome, async ([job]) => {
    if (!job.data?.to || !job.data.password || !job.data.hotelName) throw new Error("Invalid user welcome payload.");
    const result = await sendUserWelcomeEmail(job.data);
    console.log(`[worker] User welcome email ${job.id} sent to ${job.data.to}`);
    return result;
  });
  await boss.work<HotelWelcomeJob>(queues.hotelWelcome, async ([job]) => {
    if (!job.data?.to || !job.data.hotelName || !job.data.email) throw new Error("Invalid hotel welcome payload.");
    const result = await sendHotelWelcomeEmail(job.data);
    console.log(`[worker] Hotel welcome email ${job.id} sent to ${job.data.to}`);
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
  await boss.schedule(queues.revenueDaily, "15 6 * * *", {}, { tz: "UTC", singletonKey: "revenue-daily", singletonSeconds: 3600 });
  await boss.work<{ hotelTenantId?: string }>(queues.revenueDaily, async ([job]) => {
    const prisma = createJobPrisma(2);
    try {
      const hotelTenantId = typeof job.data?.hotelTenantId === "string" ? job.data.hotelTenantId : undefined;
      const results = await generateAllHotelForecastTables(prisma, hotelTenantId);
      console.log(`[worker] Revenue daily completed`, { hotels: results.length, failed: results.filter((item) => item.ok === false).length });
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
