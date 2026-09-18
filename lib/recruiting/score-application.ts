import { parseQuizAnswers } from "./application-fields";
import { readRecruitingCvText, readRecruitingExtraText, unpackCvRef } from "./cv-storage";
import { completeHotelChatJson } from "../ai/complete";

const SUGGESTIONS = ["recommended", "possible", "needsReview", "notAFit"] as const;

type ScoreDb = {
  hotelAiSettings: unknown;
  hotelAiProviderCredential: unknown;
  recruitingApplication: {
    findFirst: (args: object) => Promise<ApplicationRow | null>;
    update: (args: object) => Promise<unknown>;
    updateMany: (args: object) => Promise<unknown>;
  };
  $executeRawUnsafe: (sql: string) => Promise<unknown>;
};

type ApplicationRow = {
  id: string;
  firstName: string;
  lastName: string;
  message: string;
  cvFileName: string;
  answers: unknown;
  job: { title: string; description: string; notes: string; location: string; workType: string; format: string };
  files: { fileName: string; storageKey: string; mimeType: string }[];
};

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function clamp(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

async function completeJson(prisma: ScoreDb, hotelTenantId: string, messages: { role: string; content: string }[]) {
  const parsed = await completeHotelChatJson(prisma as never, hotelTenantId, messages, { temperature: 0.1, required: true });
  if (!parsed) throw new Error("Hotel AI API key is not configured.");
  return parsed;
}

export async function ensureAiSummaryColumns(prisma: ScoreDb) {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "recruiting_applications" ADD COLUMN IF NOT EXISTS "ai_summary_en" TEXT NOT NULL DEFAULT ''`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "recruiting_applications" ADD COLUMN IF NOT EXISTS "ai_summary_de" TEXT NOT NULL DEFAULT ''`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "recruiting_applications" ADD COLUMN IF NOT EXISTS "ai_summary_it" TEXT NOT NULL DEFAULT ''`);
  } catch (error) {
    console.error("Could not add AI summary columns", error);
  }
}

export function jobPostingText(job: ApplicationRow["job"]) {
  return [
    `Job title: ${job.title}`,
    job.workType ? `Work type: ${job.workType}` : "",
    job.location ? `Location: ${job.location}` : "",
    job.notes ? `Notes: ${job.notes}` : "",
    stripHtml(job.description),
  ].filter(Boolean).join("\n");
}

export async function applicantMaterialFromCache(application: ApplicationRow) {
  const format = application.job.format.toLowerCase();
  const parts: string[] = [`Applicant: ${application.firstName} ${application.lastName}`.trim(), `Job format: ${format}`];
  const answers = parseQuizAnswers(application.answers)
    .map((row) => `${row.pageName ? `${row.pageName} / ` : ""}${row.prompt}: ${row.value}`)
    .join("\n");
  if (answers) parts.push(`Quiz answers:\n${answers}`);
  parts.push(`Application message:\n${application.message.trim() || "(none)"}`);
  const cv = unpackCvRef(application.cvFileName);
  if (cv.storageKey) {
    const text = await readRecruitingCvText(cv.storageKey);
    parts.push(text ? `CV (${cv.displayName}):\n${text.slice(0, 12000)}` : `CV file on record: ${cv.displayName || "CV"} (indexed text not available).`);
  } else {
    parts.push("CV: (none)");
  }
  for (const file of application.files) {
    if (file.mimeType.startsWith("image/")) continue;
    const text = await readRecruitingExtraText(file.storageKey);
    if (text) parts.push(`Extra file ${file.fileName}:\n${text.slice(0, 6000)}`);
  }
  return parts.join("\n\n").slice(0, 18000);
}

export async function applyRecruitingAiScore(prisma: ScoreDb, hotelTenantId: string, application: ApplicationRow, pack: string) {
  const jobText = jobPostingText(application.job);
  const parsed = await completeJson(prisma, hotelTenantId, [
    {
      role: "system",
      content: "You score hotel job applications. Use only the provided job posting and applicant material. Do not invent employers, years, or skills. Return JSON only.",
    },
    {
      role: "user",
      content: `Score this applicant for the job.\nReturn JSON: {"score":0-100,"recommendation":"recommended"|"possible"|"needsReview"|"notAFit","competencies":{"social":0-100,"professional":0-100,"methodical":0-100,"personal":0-100},"summaryEn":"6 to 8 lines","summaryDe":"6 to 8 lines in German","summaryIt":"6 to 8 lines in Italian"}\nEach summary must be 6-8 short lines, facts only from the applicant material (not the job ad). Do not invent years, employers, or skills. If something is not stated, omit it.\n\nJob posting:\n${jobText.slice(0, 6000)}\n\nApplicant material:\n${pack}`,
    },
  ]);
  const score = clamp(parsed.score);
  const recommendation = SUGGESTIONS.find((item) => item === parsed.recommendation);
  const competencies = parsed.competencies && typeof parsed.competencies === "object" ? parsed.competencies as Record<string, unknown> : {};
  const social = clamp(competencies.social);
  const professional = clamp(competencies.professional);
  const methodical = clamp(competencies.methodical);
  const personal = clamp(competencies.personal);
  if (score == null || !recommendation || social == null || professional == null || methodical == null || personal == null) {
    throw new Error("Invalid model score payload.");
  }
  const summaryEn = typeof parsed.summaryEn === "string" ? parsed.summaryEn.trim().slice(0, 2500) : "";
  const summaryDe = typeof parsed.summaryDe === "string" ? parsed.summaryDe.trim().slice(0, 2500) : "";
  const summaryIt = typeof parsed.summaryIt === "string" ? parsed.summaryIt.trim().slice(0, 2500) : "";
  if (!summaryEn || !summaryDe || !summaryIt) {
    throw new Error("Invalid model summary payload.");
  }
  await prisma.recruitingApplication.update({
    where: { id: application.id },
    data: {
      aiStatus: "READY",
      aiError: null,
      aiScore: score,
      aiRecommendation: recommendation,
      aiSocial: social,
      aiProfessional: professional,
      aiMethodical: methodical,
      aiPersonal: personal,
      aiSummaryEn: summaryEn,
      aiSummaryDe: summaryDe,
      aiSummaryIt: summaryIt,
      aiScoredAt: new Date(),
    },
  });
  return { applicationId: application.id, score, recommendation };
}

export async function scoreRecruitingApplicationCached(prisma: ScoreDb, hotelTenantId: string, applicationId: string) {
  await ensureAiSummaryColumns(prisma);
  const application = await prisma.recruitingApplication.findFirst({
    where: { id: applicationId, hotelTenantId },
    include: {
      job: { select: { title: true, description: true, notes: true, location: true, workType: true, format: true } },
      files: { select: { fileName: true, storageKey: true, mimeType: true } },
    },
  });
  if (!application) throw new Error("Application not found");
  await prisma.recruitingApplication.update({
    where: { id: application.id },
    data: { aiStatus: "PENDING", aiError: null },
  });
  try {
    const pack = await applicantMaterialFromCache(application);
    return await applyRecruitingAiScore(prisma, hotelTenantId, application, pack);
  } catch (error) {
    await prisma.recruitingApplication.updateMany({
      where: { id: applicationId, hotelTenantId },
      data: {
        aiStatus: "FAILED",
        aiError: error instanceof Error ? error.message.slice(0, 500) : "Score failed",
      },
    });
    throw error;
  }
}
