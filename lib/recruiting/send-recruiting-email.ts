import "server-only";

import { Prisma } from "../../app/generated/prisma/client";
import { prisma } from "../prisma";
import { sendMail } from "../mail/smtp";
import type { Locale } from "../i18n/dictionaries";
import { EMAIL_LOCALES, seedEmailTemplateRows } from "./email-template-fields";
import type { EmailCat } from "./preview-data";

const categoryMap = { received: "RECEIVED", offer: "OFFER", reject: "REJECT" } as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appBaseUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function absoluteUrl(path: string) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${appBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeLocale(value: string | null | undefined): Locale {
  const locale = (value || "").toLowerCase();
  return EMAIL_LOCALES.includes(locale as Locale) ? locale as Locale : "en";
}

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*(name|job_name|hotel_name|hotel_email|logo)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

function renderBodyHtml(body: string, logoUrl: string) {
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="" style="max-width:180px;height:auto;display:block;margin-top:12px" />`
    : "";
  return body.split(/\{\{\s*logo\s*\}\}/g).map((part) => escapeHtml(part).replace(/\n/g, "<br>\n")).join(logoHtml);
}

async function ensureTemplates(hotelTenantId: string) {
  const existing = await prisma.recruitingEmailTemplate.findMany({ where: { hotelTenantId } });
  const present = new Set(existing.map((row) => `${row.category}:${row.locale}`));
  const missing = seedEmailTemplateRows().filter((row) => !present.has(`${row.category}:${row.locale}`));
  if (!missing.length) return existing;
  try {
    await prisma.recruitingEmailTemplate.createMany({
      data: missing.map((row) => ({ hotelTenantId, ...row })),
      skipDuplicates: true,
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
  }
  return prisma.recruitingEmailTemplate.findMany({ where: { hotelTenantId } });
}

function hotelNameForLocale(hotel: { hotelNameEn: string; hotelNameDe: string; hotelNameIt: string }, locale: Locale) {
  if (locale === "de") return hotel.hotelNameDe.trim() || hotel.hotelNameEn.trim() || hotel.hotelNameIt.trim();
  if (locale === "it") return hotel.hotelNameIt.trim() || hotel.hotelNameEn.trim() || hotel.hotelNameDe.trim();
  return hotel.hotelNameEn.trim() || hotel.hotelNameDe.trim() || hotel.hotelNameIt.trim();
}

function jobTitleForLocale(job: { title: string; titleDe: string; titleIt: string }, locale: Locale) {
  if (locale === "de") return job.titleDe.trim() || job.title.trim() || job.titleIt.trim();
  if (locale === "it") return job.titleIt.trim() || job.title.trim() || job.titleDe.trim();
  return job.title.trim() || job.titleDe.trim() || job.titleIt.trim();
}

export async function sendRecruitingTemplateEmail(input: {
  hotelTenantId: string;
  category: EmailCat;
  applicationId: string;
}): Promise<{ sent: boolean; auto: boolean; reason?: string }> {
  const application = await prisma.recruitingApplication.findFirst({
    where: { id: input.applicationId, hotelTenantId: input.hotelTenantId },
    include: {
      job: { select: { title: true, titleDe: true, titleIt: true } },
      hotelTenant: { select: { hotelNameEn: true, hotelNameDe: true, hotelNameIt: true, email: true } },
    },
  });
  if (!application) return { sent: false, auto: false, reason: "APPLICATION_NOT_FOUND" };
  if (!application.email.trim()) return { sent: false, auto: false, reason: "NO_RECIPIENT" };

  const rows = await ensureTemplates(input.hotelTenantId);
  const locale = normalizeLocale(application.locale);
  const category = categoryMap[input.category];
  const template = rows.find((row) => row.category === category && row.locale === locale)
    || rows.find((row) => row.category === category && row.locale === "en")
    || rows.find((row) => row.category === category);
  if (!template) return { sent: false, auto: false, reason: "TEMPLATE_MISSING" };
  if (!template.autoSend) return { sent: false, auto: false, reason: "AUTO_OFF" };

  const settings = await prisma.recruitingSettings.findUnique({ where: { hotelTenantId: input.hotelTenantId } });
  const hotelEmail = settings?.replyEmail?.trim() || application.hotelTenant.email || "";
  const logoUrl = settings?.emailLogo?.trim() ? absoluteUrl(settings.emailLogo.trim()) : "";
  const vars = {
    name: `${application.firstName} ${application.lastName}`.trim(),
    job_name: jobTitleForLocale(application.job, locale),
    hotel_name: hotelNameForLocale(application.hotelTenant, locale),
    hotel_email: hotelEmail,
    logo: logoUrl,
  };
  const subject = fill(template.subject, { ...vars, logo: "" });
  const textBody = fill(template.body, vars);
  const htmlSource = fill(template.body, { ...vars, logo: "{{logo}}" });
  const htmlBody = renderBodyHtml(htmlSource, logoUrl);

  try {
    const result = await sendMail({
      to: application.email.trim(),
      subject,
      text: textBody,
      html: htmlBody,
      replyTo: hotelEmail || undefined,
    });
    if (!result.sent) return { sent: false, auto: true, reason: result.reason };
    return { sent: true, auto: true };
  } catch (error) {
    console.error("Recruiting email send failed", error);
    return { sent: false, auto: true, reason: "SEND_FAILED" };
  }
}
