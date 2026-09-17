import { getJobQueue, queues, type ManualIndexJob } from "../jobs/queue";

export async function dispatchManualIndex(hotelTenantId: string, documentId: string) {
  const boss = await getJobQueue();
  const data: ManualIndexJob = { hotelTenantId, documentId };
  return boss.send(queues.manualIndex, data, { singletonKey: documentId });
}
