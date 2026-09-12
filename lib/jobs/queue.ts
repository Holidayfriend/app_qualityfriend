import { PgBoss } from "pg-boss";

export const queues = { smoke: "qualityfriend-smoke", competitors: "competitors-refresh" } as const;
export type SmokeJob = { message: string };
export type CompetitorRefreshJob = { hotelTenantId: string; locationKey: string };

export function createJobQueue(worker = false) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");
  const boss = new PgBoss({ connectionString, supervise: worker, schedule: false });
  boss.on("error", (error) => console.error("[queue]", error.message));
  return boss;
}

export async function initializeQueues(boss: PgBoss) {
  await boss.createQueue(queues.competitors, {
    policy: "exclusive", retryLimit: 3, retryDelay: 30, retryBackoff: true,
    expireInSeconds: 1800, deleteAfterSeconds: 7 * 24 * 60 * 60,
  });
  await boss.createQueue(queues.smoke, {
    retryLimit: 3,
    retryDelay: 10,
    retryBackoff: true,
    expireInSeconds: 300,
    deleteAfterSeconds: 7 * 24 * 60 * 60,
  });
}

const globalQueue = globalThis as typeof globalThis & {
  qualityfriendQueue?: Promise<PgBoss>;
};

// Shared by server requests; importing this module does not open a connection.
export function getJobQueue(): Promise<PgBoss> {
  if (!globalQueue.qualityfriendQueue) {
    globalQueue.qualityfriendQueue = (async () => {
      const boss = createJobQueue();
      try {
        await boss.start();
        await initializeQueues(boss);
        return boss;
      } catch (error) {
        await boss.stop().catch(() => {});
        throw error;
      }
    })().catch((error) => {
      globalQueue.qualityfriendQueue = undefined;
      throw error;
    });
  }
  return globalQueue.qualityfriendQueue;
}

// Call only from trusted server code, after checking the user's permissions.
export async function dispatchSmokeJob(data: SmokeJob) {
  const boss = await getJobQueue();
  return boss.send(queues.smoke, data);
}

export async function dispatchCompetitorRefresh(data: CompetitorRefreshJob) {
  const boss = await getJobQueue();
  return boss.send(queues.competitors, data, { singletonKey: data.hotelTenantId });
}
