import "dotenv/config";
import { createJobQueue, initializeQueues, queues, type SmokeJob } from "../lib/jobs/queue";

const boss = createJobQueue(true);
let stopping = false;

async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("[worker] Stopping; waiting for active jobs.");
  await boss.stop({ graceful: true, timeout: 30_000 });
}

async function main() {
  await boss.start();
  await initializeQueues(boss);
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
