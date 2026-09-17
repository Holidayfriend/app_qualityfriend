import { createJobPrisma } from "../jobs/prisma";
import type { RecruitingAiScoreJob } from "../jobs/queue";
import { parseQuizAnswers } from "./application-fields";
import { unpackCvRef, readRecruitingCv, readRecruitingExtraFile, fileMime, writeRecruitingCvText, writeRecruitingExtraText } from "./cv-storage";
import { extractRecruitingDocumentText } from "./extract-document";

const SUGGESTIONS = ["recommended", "possible", "needsReview", "notAFit"] as const;

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function clamp(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
}

async function completeJson(messages: { role: string; content: string }[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  } | null;
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI request failed.");
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty model reply.");
  return JSON.parse(content) as Record<string, unknown>;
}

export async function scoreRecruitingApplication(data: RecruitingAiScoreJob) {
  const prisma = createJobPrisma(2);
  try {
    const application = await prisma.recruitingApplication.findFirst({
      where: { id: data.applicationId, hotelTenantId: data.hotelTenantId },
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
    const jobText = [
      `Job title: ${application.job.title}`,
      application.job.workType ? `Work type: ${application.job.workType}` : "",
      application.job.location ? `Location: ${application.job.location}` : "",
      application.job.notes ? `Notes: ${application.job.notes}` : "",
      stripHtml(application.job.description),
    ].filter(Boolean).join("\n");
    const format = application.job.format.toLowerCase();
    const parts: string[] = [`Applicant: ${application.firstName} ${application.lastName}`.trim(), `Job format: ${format}`];
    if (format === "quiz") {
      const answers = parseQuizAnswers(application.answers)
        .map((row) => `${row.pageName ? `${row.pageName} / ` : ""}${row.prompt}: ${row.value}`)
        .join("\n");
      parts.push(`Quiz answers:\n${answers || "(none)"}`);
      if (application.message.trim()) parts.push(`Application message:\n${application.message.trim()}`);
    } else {
      parts.push(`Application message:\n${application.message.trim() || "(none)"}`);
      const cv = unpackCvRef(application.cvFileName);
      if (cv.storageKey) {
        const buffer = await readRecruitingCv(cv.storageKey);
        const text = buffer ? await extractRecruitingDocumentText(buffer, fileMime(cv.storageKey), cv.displayName || cv.storageKey) : "";
        if (text) await writeRecruitingCvText(cv.storageKey, text);
        parts.push(`CV (${cv.displayName}):\n${text.slice(0, 12000) || "(could not extract text)"}`);
      } else {
        parts.push("CV: (none)");
      }
    }
    for (const file of application.files) {
      if (file.mimeType.startsWith("image/")) continue;
      const buffer = await readRecruitingExtraFile(file.storageKey);
      if (!buffer) continue;
      const text = await extractRecruitingDocumentText(buffer, file.mimeType, file.fileName);
      if (text) {
        await writeRecruitingExtraText(file.storageKey, text);
        parts.push(`Extra file ${file.fileName}:\n${text.slice(0, 6000)}`);
      }
    }
    const pack = parts.join("\n\n").slice(0, 18000);
    const parsed = await completeJson([
      {
        role: "system",
        content: "You score hotel job applications. Use only the provided job posting and applicant material. Do not invent employers, years, or skills. Return JSON only.",
      },
      {
        role: "user",
        content: `Score this applicant for the job.\nReturn JSON: {"score":0-100,"recommendation":"recommended"|"possible"|"needsReview"|"notAFit","competencies":{"social":0-100,"professional":0-100,"methodical":0-100,"personal":0-100}}\n\nJob posting:\n${jobText.slice(0, 6000)}\n\nApplicant material:\n${pack}`,
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
        aiScoredAt: new Date(),
      },
    });
    return { applicationId: application.id, score, recommendation };
  } catch (error) {
    await prisma.recruitingApplication.updateMany({
      where: { id: data.applicationId, hotelTenantId: data.hotelTenantId },
      data: {
        aiStatus: "FAILED",
        aiError: error instanceof Error ? error.message.slice(0, 500) : "Score failed",
      },
    });
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
