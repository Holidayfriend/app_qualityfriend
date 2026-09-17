import type { RecruitingApplication, RecruitingApplicationStage } from "../../app/generated/prisma/client";
import type { DeptId } from "../i18n/recruiting-messages";
import type { AppStage, Applicant } from "./preview-data";
import { unpackCvRef } from "./cv-storage";

const stages = ["new", "invited", "offer", "hired", "rejected", "archived"] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ApplicationJobInfo = {
  title: string;
  titleDe: string;
  titleIt: string;
  format: string;
  department?: { nameEn: string; nameDe: string; nameIt: string } | null;
};

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function mapAi(row: RecruitingApplication, stage: AppStage) {
  if (row.aiStatus === "READY" && row.aiScore != null && row.aiRecommendation) {
    const suggestion = (["recommended", "possible", "needsReview", "notAFit"] as const).includes(row.aiRecommendation as Applicant["suggestion"])
      ? (row.aiRecommendation as Applicant["suggestion"])
      : "needsReview";
    return {
      score: `${row.aiScore}%` as const,
      suggestion: stage === "archived" ? "archived" as const : suggestion,
      competencies: {
        social: row.aiSocial ?? 0,
        professional: row.aiProfessional ?? 0,
        methodical: row.aiMethodical ?? 0,
        personal: row.aiPersonal ?? 0,
      },
      aiStatus: "READY" as const,
    };
  }
  if (row.aiStatus === "FAILED") {
    return {
      score: "–" as const,
      suggestion: stage === "archived" ? "archived" as const : "needsReview" as const,
      competencies: { social: 0, professional: 0, methodical: 0, personal: 0 },
      aiStatus: "FAILED" as const,
    };
  }
  return {
    score: "…" as const,
    suggestion: stage === "archived" ? "archived" as const : "pending" as const,
    competencies: { social: 0, professional: 0, methodical: 0, personal: 0 },
    aiStatus: "PENDING" as const,
  };
}

export function mapDeptId(name: string | undefined | null): DeptId {
  const value = (name || "").toLowerCase();
  if (value.includes("house") || value.includes("zimmer") || value.includes("puliz")) return "housekeeping";
  if (value.includes("kitchen") || value.includes("küche") || value.includes("cucina") || value.includes("koch")) return "kitchen";
  if (value.includes("spa") || value.includes("wellness") || value.includes("sea")) return "seaspa";
  if (value.includes("maint") || value.includes("technik") || value.includes("tecn")) return "maintenance";
  if (value.includes("rest") || value.includes("service") || value.includes("gastro") || value.includes("f&b")) return "restaurant";
  return "reception";
}

export function mapStage(stage: RecruitingApplicationStage | string): AppStage {
  const value = String(stage).toLowerCase();
  return (stages.includes(value as AppStage) ? value : "new") as AppStage;
}

export function toDbStage(stage: string): RecruitingApplicationStage | null {
  const value = stage.toLowerCase();
  if (!stages.includes(value as AppStage)) return null;
  return value.toUpperCase() as RecruitingApplicationStage;
}

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?";
}

function pickTitle(job: ApplicationJobInfo | null | undefined, locale?: string) {
  if (!job) return "";
  if (locale === "de" && job.titleDe.trim()) return job.titleDe;
  if (locale === "it" && job.titleIt.trim()) return job.titleIt;
  return job.title;
}

function pickDeptName(job: ApplicationJobInfo | null | undefined, locale?: string) {
  const dept = job?.department;
  if (!dept) return "";
  if (locale === "de" && dept.nameDe.trim()) return dept.nameDe;
  if (locale === "it" && dept.nameIt.trim()) return dept.nameIt;
  return dept.nameEn || dept.nameDe || dept.nameIt;
}

function formatDate(value: Date, locale?: string) {
  try {
    return value.toLocaleDateString(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB");
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

export function parseQuizAnswers(value: unknown): NonNullable<Applicant["answers"]> {
  if (!Array.isArray(value)) return [];
  const rows: NonNullable<Applicant["answers"]> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const type = text(item.type, 40);
    if (type === "form") continue;
    const prompt = text(item.prompt, 500);
    const pageName = text(item.pageName, 120);
    const labels = Array.isArray(item.labels) ? item.labels.map((label) => text(label, 300)).filter(Boolean) : [];
    const valueText = labels.length ? labels.join(", ") : text(item.value, 2000);
    if (!prompt && !valueText) continue;
    rows.push({ pageName, prompt: prompt || pageName || "–", value: valueText || "–", type: type || "answer" });
  }
  return rows;
}

export type ApplicationExtraFile = {
  id: string;
  fileName: string;
  storageKey: string;
  mimeType: string;
  url: string;
  createdAt: string;
};

export function parseApplicationNotes(value: unknown): {
  tags: string[];
  comments: Applicant["comments"];
  files: ApplicationExtraFile[];
  campaign: { code: string; source: string; name: string; team: string } | null;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { tags: [], comments: [], files: [], campaign: null };
  }
  const body = value as { tags?: unknown; comments?: unknown; files?: unknown; campaign?: unknown };
  const tags = Array.isArray(body.tags)
    ? body.tags.map((tag) => text(tag, 80)).filter(Boolean).slice(0, 40)
    : [];
  const comments: Applicant["comments"] = [];
  if (Array.isArray(body.comments)) {
    for (const entry of body.comments.slice(0, 200)) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      const commentText = text(item.text, 4000);
      if (!commentText) continue;
      comments.push({
        text: commentText,
        author: text(item.author, 120) || "–",
        date: text(item.date, 40) || "",
      });
    }
  }
  const files: ApplicationExtraFile[] = [];
  if (Array.isArray(body.files)) {
    for (const entry of body.files.slice(0, 100)) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Record<string, unknown>;
      const id = text(item.id, 80);
      const fileName = text(item.fileName, 255);
      const storageKey = text(item.storageKey, 80);
      if (!id || !fileName || !storageKey) continue;
      files.push({
        id,
        fileName,
        storageKey,
        mimeType: text(item.mimeType, 120) || "application/octet-stream",
        url: text(item.url, 320),
        createdAt: text(item.createdAt, 40) || new Date().toISOString(),
      });
    }
  }
  let campaign: { code: string; source: string; name: string; team: string } | null = null;
  if (body.campaign && typeof body.campaign === "object" && !Array.isArray(body.campaign)) {
    const item = body.campaign as Record<string, unknown>;
    const code = text(item.code, 32);
    const source = text(item.source, 80);
    const name = text(item.name, 180);
    const team = text(item.team, 120);
    if (code || source || name || team) campaign = { code, source, name, team };
  }
  return { tags, comments, files, campaign };
}

export function notesPayload(
  tags: string[],
  comments: Applicant["comments"],
  files: ApplicationExtraFile[] = [],
  campaign?: { code: string; source: string; name: string; team: string } | null,
) {
  return {
    tags: tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 40),
    comments: comments.slice(0, 200).map((entry) => ({
      text: entry.text.trim().slice(0, 4000),
      author: entry.author.trim().slice(0, 120) || "–",
      date: entry.date.trim().slice(0, 40),
    })).filter((entry) => entry.text),
    files: files.slice(0, 100).map((entry) => ({
      id: entry.id,
      fileName: entry.fileName.slice(0, 255),
      storageKey: entry.storageKey.slice(0, 80),
      mimeType: entry.mimeType.slice(0, 120),
      url: entry.url.slice(0, 320),
      createdAt: entry.createdAt.slice(0, 40),
    })),
    ...(campaign ? {
      campaign: {
        code: campaign.code.slice(0, 32),
        source: campaign.source.slice(0, 80),
        name: campaign.name.slice(0, 180),
        team: campaign.team.slice(0, 120),
      },
    } : {}),
  };
}

export function toPublicApplicant(
  row: RecruitingApplication,
  job?: ApplicationJobInfo | null,
  locale?: string,
  extras?: { tags?: string[]; comments?: Applicant["comments"]; bestTime?: string; source?: string },
): Applicant {
  const stage = mapStage(row.stage);
  const answers = parseQuizAnswers(row.answers);
  const notes = parseApplicationNotes(row.notes);
  const ai = mapAi(row, stage);
  const deptName = pickDeptName(job, locale);
  const jobTitle = pickTitle(job, locale);
  const format = (job?.format || "").toLowerCase();
  const cv = unpackCvRef(row.cvFileName);
  const campaignSource = notes.campaign
    ? `${notes.campaign.source || "Campaign"}${notes.campaign.name ? ` · ${notes.campaign.name}` : ""}${notes.campaign.team ? ` · ${notes.campaign.team}` : ""}`
    : "";
  return {
    id: row.id,
    initials: initials(row.firstName, row.lastName),
    name: `${row.firstName} ${row.lastName}`.trim(),
    role: jobTitle || deptName || "–",
    dept: mapDeptId(deptName),
    stage,
    dateDisplay: null,
    score: ai.score,
    suggestion: ai.suggestion,
    email: row.email || "–",
    phone: row.phone || "–",
    bestTime: extras?.bestTime || "–",
    date: formatDate(row.createdAt, locale),
    source: extras?.source || campaignSource || (format === "quiz" || answers.length ? "Quiz-Funnel" : "Formular"),
    cv: cv.displayName || null,
    message: row.message || "",
    competencies: ai.competencies,
    aiStatus: ai.aiStatus,
    tags: extras?.tags ?? notes.tags,
    comments: extras?.comments ?? notes.comments,
    answers,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    cvDownloadable: Boolean(cv.storageKey),
  };
}

export function parseManualApplication(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const firstName = text(data.firstName, 120);
  const lastName = text(data.lastName, 120);
  const jobId = typeof data.jobId === "string" && uuid.test(data.jobId) ? data.jobId : "";
  if (!firstName || !lastName || !jobId) return null;
  return {
    jobId,
    firstName,
    lastName,
    email: text(data.email, 320),
    phone: text(data.phone, 40),
    message: text(data.message, 8000),
    cvFileName: text(data.cvFileName, 255),
    locale: text(data.locale, 8) || "en",
  };
}

export function isUuid(value: string) {
  return uuid.test(value);
}
