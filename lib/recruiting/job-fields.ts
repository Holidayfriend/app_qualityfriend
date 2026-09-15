import { Prisma, type RecruitingJob, type RecruitingJobFormat, type RecruitingJobStatus } from "../../app/generated/prisma/client";

export const locales = ["de", "en", "it"] as const;
export type JobLocale = (typeof locales)[number];
export const formats = ["classic", "quiz"] as const;
export const listingStatuses = ["draft", "active", "archived"] as const;
const workTypes = ["fullOrPart", "full", "part", "apprentice"] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type FormatKey = (typeof formats)[number];
type StatusKey = (typeof listingStatuses)[number];

export type JobDepartmentNames = { nameEn: string; nameDe: string; nameIt: string };

export type PublicJob = {
  id: string;
  slug: string;
  format: FormatKey;
  title: string;
  departmentId: string;
  dept: string;
  type: string;
  start: string;
  notes: string;
  description: string;
  autoMessage: string;
  location: string;
  cvRequired: boolean;
  status: StatusKey;
  langs: JobLocale[];
  clicks: number;
  apps: number;
  conv: string;
  listingImage: string;
  logoImage: string;
  quiz: { footer: { impressumUrl: string; privacyUrl: string }; pages: unknown[] } | null;
};

export function slugify(title: string) {
  const base = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "job";
}

export function sanitizeJobHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?(?:iframe|object|embed|link|meta|style)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, "");
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function asLocales(value: unknown): JobLocale[] {
  if (!Array.isArray(value)) return ["de"];
  const picked = locales.filter((item) => value.includes(item));
  return picked.length ? picked : ["de"];
}

function walk(nodes: unknown, visit: (node: Record<string, unknown>) => void) {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const item = node as Record<string, unknown>;
    visit(item);
    const columns = item.columns;
    if (Array.isArray(columns)) for (const column of columns) walk(column, visit);
  }
}

export function quizHasDataForm(quiz: unknown) {
  if (!quiz || typeof quiz !== "object") return false;
  const pagesByLang = (quiz as { pagesByLang?: unknown }).pagesByLang;
  if (!pagesByLang || typeof pagesByLang !== "object") return false;
  const packs = Object.values(pagesByLang as Record<string, unknown>);
  if (!packs.length) return false;
  return packs.every((pages) => {
    let found = false;
    if (!Array.isArray(pages)) return false;
    for (const page of pages) {
      if (!page || typeof page !== "object") continue;
      walk((page as { elements?: unknown }).elements, (node) => {
        if (node.type === "form") found = true;
      });
    }
    return found;
  });
}

export function parseQuiz(value: unknown): Prisma.InputJsonValue | null {
  if (!value || typeof value !== "object") return null;
  const body = value as { footer?: unknown; pagesByLang?: unknown };
  const footer = body.footer && typeof body.footer === "object" ? body.footer as { impressumUrl?: unknown; privacyUrl?: unknown } : {};
  const pagesByLang = body.pagesByLang && typeof body.pagesByLang === "object" ? body.pagesByLang as Record<string, unknown> : null;
  if (!pagesByLang) return null;
  const packed: Record<string, unknown> = {};
  for (const locale of locales) {
    if (Array.isArray(pagesByLang[locale])) packed[locale] = pagesByLang[locale];
  }
  if (!Object.keys(packed).length) return null;
  const quiz = {
    footer: {
      impressumUrl: text(footer.impressumUrl, 500) || "https://qualityfriend.solutions/",
      privacyUrl: text(footer.privacyUrl, 500) || "https://qualityfriend.solutions/",
    },
    pagesByLang: packed,
  };
  return quizHasDataForm(quiz) ? (quiz as Prisma.InputJsonValue) : null;
}

export function pagesForLocale(quiz: unknown, locale: string) {
  if (!quiz || typeof quiz !== "object") return [];
  const pagesByLang = (quiz as { pagesByLang?: Record<string, unknown> }).pagesByLang;
  if (!pagesByLang) return [];
  const direct = pagesByLang[locale];
  if (Array.isArray(direct) && direct.length) return direct;
  for (const key of locales) {
    const fallback = pagesByLang[key];
    if (Array.isArray(fallback) && fallback.length) return fallback;
  }
  return [];
}

export function quizFooter(quiz: unknown) {
  const footer = quiz && typeof quiz === "object" ? (quiz as { footer?: { impressumUrl?: string; privacyUrl?: string } }).footer : undefined;
  return {
    impressumUrl: footer?.impressumUrl || "https://qualityfriend.solutions/",
    privacyUrl: footer?.privacyUrl || "https://qualityfriend.solutions/",
  };
}

export function parseJobInput(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const format = formats.includes(data.format as FormatKey) ? data.format as FormatKey : null;
  const status = listingStatuses.includes(data.status as StatusKey) ? data.status as StatusKey : null;
  const title = text(data.title, 180);
  const departmentId = typeof data.departmentId === "string" && uuid.test(data.departmentId) ? data.departmentId : "";
  const workType = typeof data.workType === "string" && workTypes.includes(data.workType as (typeof workTypes)[number]) ? data.workType : "";
  if (!format || !status || !title || !departmentId || !workType) return null;
  const quiz = format === "quiz" ? parseQuiz(data.quiz) : undefined;
  if (format === "quiz" && !quiz) return null;
  return {
    format: format.toUpperCase() as RecruitingJobFormat,
    status: status.toUpperCase() as RecruitingJobStatus,
    title,
    departmentId,
    workType,
    startFrom: text(data.startFrom, 120),
    notes: text(data.notes, 4000),
    description: sanitizeJobHtml(typeof data.description === "string" ? data.description : ""),
    autoMessage: sanitizeJobHtml(typeof data.autoMessage === "string" ? data.autoMessage : ""),
    location: text(data.location, 180),
    cvRequired: data.cvRequired === true,
    languages: asLocales(data.languages),
    listingImage: text(data.listingImage, 255),
    logoImage: text(data.logoImage, 255),
    quiz: format === "quiz" ? (quiz as Prisma.InputJsonValue) : Prisma.DbNull,
  };
}

export function parseApplicationInput(body: unknown, format: FormatKey, cvRequired: boolean) {
  if (!body || typeof body !== "object") return null;
  const data = body as Record<string, unknown>;
  const firstName = text(data.firstName, 120);
  const lastName = text(data.lastName, 120);
  const email = text(data.email, 320);
  const locale = locales.includes(data.locale as JobLocale) ? data.locale as JobLocale : "en";
  if (!firstName || !lastName || !email.includes("@")) return null;
  const cvFileName = text(data.cvFileName, 255);
  if (cvRequired && !cvFileName) return null;
  const answers = Array.isArray(data.answers) ? data.answers : [];
  if (format === "quiz" && !answers.length) return null;
  return {
    locale,
    salutation: text(data.salutation, 20),
    firstName,
    lastName,
    email,
    phone: text(data.phone, 40),
    message: text(data.message, 8000),
    cvFileName,
    keepForOtherJobs: data.keepForOtherJobs === true,
    answers: (format === "quiz" ? answers : []) as Prisma.InputJsonValue,
  };
}

function conv(clicks: number, apps: number) {
  if (!clicks) return "–";
  return `${((apps / clicks) * 100).toFixed(2)}%`;
}

export function pickLocalized(en: string, de: string, it: string, locale?: string) {
  const lang = locales.includes(locale as JobLocale) ? locale as JobLocale : "en";
  const value = lang === "de" ? de : lang === "it" ? it : en;
  return value.trim() ? value : en;
}

export function toPublicJob(job: RecruitingJob, apps = 0, locale?: string, includeQuiz = true, department?: JobDepartmentNames | null): PublicJob {
  const langs = asLocales(job.languages);
  const format = job.format.toLowerCase() as FormatKey;
  return {
    id: job.id,
    slug: job.slug,
    format,
    title: pickLocalized(job.title, job.titleDe, job.titleIt, locale),
    departmentId: job.departmentId,
    dept: department ? pickLocalized(department.nameEn, department.nameDe, department.nameIt, locale) : "",
    type: job.workType,
    start: job.startFrom,
    notes: job.notes,
    description: pickLocalized(job.description, job.descriptionDe, job.descriptionIt, locale),
    autoMessage: pickLocalized(job.autoMessage, job.autoMessageDe, job.autoMessageIt, locale),
    location: pickLocalized(job.location, job.locationDe, job.locationIt, locale),
    cvRequired: job.cvRequired,
    status: job.status.toLowerCase() as StatusKey,
    langs,
    clicks: job.clickCount,
    apps,
    conv: conv(job.clickCount, apps),
    listingImage: job.listingImage,
    logoImage: job.logoImage,
    quiz: includeQuiz && format === "quiz" ? { footer: quizFooter(job.quiz), pages: pagesForLocale(job.quiz, locale || langs[0] || "en") } : null,
  };
}

export async function uniqueSlug(exists: (slug: string) => Promise<boolean>, title: string) {
  const base = slugify(title);
  if (!(await exists(base))) return base;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${base.slice(0, 70)}-${i}`.slice(0, 80);
    if (!(await exists(candidate))) return candidate;
  }
  return `${base.slice(0, 60)}-${Date.now().toString(36)}`;
}
