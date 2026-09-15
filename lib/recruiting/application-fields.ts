import type { RecruitingApplication, RecruitingApplicationStage } from "../../app/generated/prisma/client";
import type { DeptId } from "../i18n/recruiting-messages";
import type { AppStage, Applicant } from "./preview-data";

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

function hashInt(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Deterministic demo AI score from application content (not Math.random). */
export function demoAiScore(input: {
  id: string;
  message: string;
  cvFileName: string;
  answers: unknown;
  manual?: boolean;
  stage?: AppStage;
}) {
  if (input.manual || input.stage === "archived") {
    return {
      score: "–" as const,
      suggestion: (input.stage === "archived" ? "archived" : "manualAdded") as Applicant["suggestion"],
      competencies: { social: 0, professional: 0, methodical: 0, personal: 0 },
    };
  }
  const answersText = typeof input.answers === "string" ? input.answers : JSON.stringify(input.answers ?? []);
  const seed = `${input.id}|${input.message}|${input.cvFileName}|${answersText}`;
  const base = hashInt(seed);
  const messageBoost = Math.min(20, Math.floor(input.message.trim().length / 20));
  const cvBoost = input.cvFileName.trim() ? 12 : 0;
  const answersBoost = Array.isArray(input.answers) && input.answers.length ? 10 : 0;
  const total = clamp(28 + (base % 55) + messageBoost + cvBoost + answersBoost, 20, 96);
  const suggestion: Applicant["suggestion"] =
    total >= 80 ? "recommended" : total >= 65 ? "possible" : total >= 45 ? "needsReview" : "notAFit";
  const offset = (n: number) => clamp(total + ((base >> n) % 17) - 8, 15, 98);
  return {
    score: `${total}%` as const,
    suggestion,
    competencies: {
      social: offset(3),
      professional: offset(8),
      methodical: offset(12),
      personal: offset(16),
    },
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

export function toPublicApplicant(
  row: RecruitingApplication,
  job?: ApplicationJobInfo | null,
  locale?: string,
  extras?: { tags?: string[]; comments?: Applicant["comments"]; bestTime?: string; source?: string },
): Applicant {
  const stage = mapStage(row.stage);
  const answers = parseQuizAnswers(row.answers);
  const ai = demoAiScore({
    id: row.id,
    message: row.message,
    cvFileName: row.cvFileName,
    answers: row.answers,
    manual: extras?.source === "manual",
    stage,
  });
  const deptName = pickDeptName(job, locale);
  const jobTitle = pickTitle(job, locale);
  const format = (job?.format || "").toLowerCase();
  return {
    id: row.id,
    initials: initials(row.firstName, row.lastName),
    name: `${row.firstName} ${row.lastName}`.trim(),
    role: jobTitle || deptName || "–",
    dept: mapDeptId(deptName),
    stage,
    dateDisplay: null,
    score: ai.score,
    suggestion: stage === "archived" ? "archived" : ai.suggestion,
    email: row.email || "–",
    phone: row.phone || "–",
    bestTime: extras?.bestTime || "–",
    date: formatDate(row.createdAt, locale),
    source: extras?.source || (format === "quiz" || answers.length ? "Quiz-Funnel" : "Formular"),
    cv: row.cvFileName || null,
    message: row.message || "",
    competencies: ai.competencies,
    tags: extras?.tags ?? [],
    comments: extras?.comments ?? [],
    answers,
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
