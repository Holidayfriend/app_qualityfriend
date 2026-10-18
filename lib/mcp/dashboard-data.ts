import { normalizePrompt, object, rows, type PortalPrompt } from "./prompt-data";

export type DashboardPrompt = PortalPrompt & { feedbackCount: number };
export type DashboardFeedback = {
  id: string;
  promptTitle: string;
  reaction: "like" | "dislike" | "none";
  userEmail: string;
  createdAt: string;
  feedbackScore: number;
};
export type DashboardStats = {
  totalPrompts: number;
  uniqueAuthors: number;
  totalFeedbackCount: number;
  averageFeedbackScore: number;
};
export type DashboardTrainingStatus = {
  available: boolean;
  trainingExamples: { total: number; pending: number; uploading: number; uploaded: number; failed: number };
  vectorStore: null | { name: string; departmentName: string };
  latestJob: null | {
    provider: string; status: string; datasetFileId: string; openaiJobId: string; resultingModel: string;
    error: string; startedAt: string; completedAt: string; createdAt: string; updatedAt: string;
  };
  activeModel: string;
};

function string(value: unknown) { return typeof value === "string" ? value : ""; }
function number(value: unknown) { const parsed = typeof value === "number" ? value : Number(value); return Number.isFinite(parsed) ? parsed : 0; }

export function normalizeDashboardPrompts(payload: unknown): DashboardPrompt[] {
  return rows(payload, ["prompts", "data"]).flatMap((entry) => {
    const prompt = normalizePrompt(entry);
    if (!prompt) return [];
    return [{ ...prompt, feedbackCount: Math.max(0, number(object(entry).feedbackCount)) }];
  });
}

export function normalizeDashboardFeedbacks(payload: unknown): DashboardFeedback[] {
  return rows(payload, ["feedbacks", "data"]).flatMap((entry, index) => {
    const feedback = object(entry);
    const prompt = object(feedback.prompt);
    const user = object(feedback.user);
    const reaction = feedback.reaction === "like" || feedback.reaction === "dislike" ? feedback.reaction : "none";
    const id = string(feedback.id) || `${string(prompt.id)}-${string(user.id)}-${index}`;
    return [{
      id,
      promptTitle: string(prompt.title),
      reaction,
      userEmail: string(user.email),
      createdAt: string(feedback.createdAt),
      feedbackScore: Math.min(100, Math.max(0, number(feedback.feedbackScore))),
    }];
  });
}

export function normalizeDashboardStats(payload: unknown): DashboardStats {
  const stats = object(payload);
  return {
    totalPrompts: Math.max(0, number(stats.totalPrompts)),
    uniqueAuthors: Math.max(0, number(stats.uniqueAuthors)),
    totalFeedbackCount: Math.max(0, number(stats.totalFeedbackCount)),
    averageFeedbackScore: Math.max(0, number(stats.averageFeedbackScore)),
  };
}

export function normalizeTrainingStatus(payload: unknown): DashboardTrainingStatus {
  const status = object(payload);
  const examples = object(status.trainingExamples);
  const vectorStore = object(status.vectorStore);
  const vectorDepartment = object(vectorStore.department);
  const latestJob = object(status.latestJob);
  return {
    available: Boolean(string(status.hotelId)),
    trainingExamples: {
      total: Math.max(0, number(examples.total)),
      pending: Math.max(0, number(examples.pending)),
      uploading: Math.max(0, number(examples.uploading)),
      uploaded: Math.max(0, number(examples.uploaded)),
      failed: Math.max(0, number(examples.failed)),
    },
    vectorStore: Object.keys(vectorStore).length ? { name: string(vectorStore.name), departmentName: string(vectorDepartment.name) } : null,
    latestJob: Object.keys(latestJob).length ? {
      provider: string(latestJob.provider), status: string(latestJob.status), datasetFileId: string(latestJob.datasetFileId),
      openaiJobId: string(latestJob.openaiJobId), resultingModel: string(latestJob.resultingModel), error: string(latestJob.error),
      startedAt: string(latestJob.startedAt), completedAt: string(latestJob.completedAt), createdAt: string(latestJob.createdAt), updatedAt: string(latestJob.updatedAt),
    } : null,
    activeModel: string(status.activeModel),
  };
}
