import { getJobQueue, queues, type RecruitingAiScoreJob } from "../jobs/queue";

export async function dispatchRecruitingAiScore(hotelTenantId: string, applicationId: string) {
  const boss = await getJobQueue();
  const data: RecruitingAiScoreJob = { hotelTenantId, applicationId };
  return boss.send(queues.recruitingAiScore, data, { singletonKey: applicationId });
}
