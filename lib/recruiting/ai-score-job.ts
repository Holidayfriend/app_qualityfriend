import { createJobPrisma } from "../jobs/prisma";
import type { RecruitingAiScoreJob } from "../jobs/queue";
import { applyRecruitingAiScore, ensureAiSummaryColumns } from "./score-application";
import { parseQuizAnswers } from "./application-fields";
import { unpackCvRef, readRecruitingCv, readRecruitingExtraFile, fileMime, writeRecruitingCvText, writeRecruitingExtraText } from "./cv-storage";
import { extractRecruitingDocumentText } from "./extract-document";

export async function scoreRecruitingApplication(data: RecruitingAiScoreJob) {
  const prisma = createJobPrisma(2);
  try {
    await ensureAiSummaryColumns(prisma);
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
    return await applyRecruitingAiScore(prisma, application, parts.join("\n\n").slice(0, 18000));
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
