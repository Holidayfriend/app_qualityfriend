import { getJobQueue, queues, type HousekeepingAiAllocateJob } from "../jobs/queue";

export async function dispatchHousekeepingAiAllocate(hotelTenantId: string, timeZone: string) {
  const boss = await getJobQueue();
  const data: HousekeepingAiAllocateJob = { hotelTenantId, timeZone };
  return boss.send(queues.housekeepingAiAllocate, data, {
    singletonKey: hotelTenantId,
    singletonSeconds: 120,
  });
}
