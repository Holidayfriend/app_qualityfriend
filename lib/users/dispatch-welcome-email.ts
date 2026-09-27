import { getJobQueue, queues, type UserWelcomeJob } from "../jobs/queue";

export async function dispatchUserWelcomeEmail(data: UserWelcomeJob) {
  const boss = await getJobQueue();
  return boss.send(queues.userWelcome, data);
}
