import "dotenv/config";
import { setTimeout as delay } from "node:timers/promises";
import { createJobQueue, initializeQueues, queues } from "../lib/jobs/queue";

async function main() {
  const boss = createJobQueue();
  try {
    await boss.start();
    await initializeQueues(boss);
    const existingId = process.argv.find((argument) => argument.startsWith("--id="))?.slice(5);
    const id = existingId ?? await boss.send(queues.smoke, { message: "Background worker is working." });
    if (!id) throw new Error("The job was not queued.");
    console.log(`${existingId ? "Checking" : "Queued"} smoke job ${id}`);
    if (process.argv.includes("--dispatch-only")) return;
    const deadline = Date.now() + 45_000;
    while (Date.now() < deadline) {
      const [job] = await boss.findJobs(queues.smoke, { id });
      if (job?.state === "completed") {
        console.log("PASS: separate worker processed the job.", job.output);
        return;
      }
      if (job?.state === "failed") throw new Error("Smoke job failed.");
      await delay(1000);
    }
    throw new Error("Job did not complete in 45 seconds. Check that the worker is running.");
  } finally {
    await boss.stop();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
