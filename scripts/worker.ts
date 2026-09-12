import "dotenv/config";
import { Pool } from "pg";
import { refreshCompetitors } from "../lib/competitors/jobs";
import { createJobQueue, initializeQueues, queues, type SmokeJob, type CompetitorRefreshJob } from "../lib/jobs/queue";

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
  await boss.work<CompetitorRefreshJob>(queues.competitors, async ([job]) => {
    try {
      const result = await refreshCompetitors(pool, job.data);
      console.log(`[worker] Competitor refresh ${job.id}`, result);
      return result;
    } catch (error) {
      console.error(`[worker] Competitor refresh ${job.id} failed`, error);
      throw error;
    }
  });
  await boss.work<SmokeJob>(queues.smoke, async ([job]) => {
    if (typeof job.data.message !== "string") throw new Error("Invalid smoke job payload.");
    console.log(`[worker] Completed smoke job ${job.id}`);
    return { message: job.data.message, processedAt: new Date().toISOString() };
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
