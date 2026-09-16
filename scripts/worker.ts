import "dotenv/config";
import { Pool } from "pg";
import { importHousekeeping, recordImportFailure, importFailureReason } from "../lib/housekeeping/import-job";
import type { HousekeepingImportJob } from "../lib/jobs/queue";
import { createJobPrisma } from "../lib/jobs/prisma";
import { createJobQueue, initializeQueues, queues, type SmokeJob } from "../lib/jobs/queue";
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
  await boss.schedule(queues.weatherDaily, "0 6,14 * * *", {}, { tz: "UTC", singletonKey: "weather-daily", singletonSeconds: 3600 });
  await boss.work(queues.weatherDaily, async () => {
    const prisma = createJobPrisma(2);
    try {
      const results = await syncAllHotelWeather(prisma);
      console.log(`[worker] Weather daily completed`, { hotels: results.length, failed: results.filter((item) => !item.ok).length });
      return { hotels: results.length };
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
