import { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { notesPayload } from "../../../../lib/recruiting/application-fields";
import { incrementCampaignApplications, incrementCampaignClicks } from "../../../../lib/recruiting/campaigns";
import { packCvRef, saveRecruitingCv } from "../../../../lib/recruiting/cv-storage";
import { dispatchRecruitingAiScore } from "../../../../lib/recruiting/dispatch-ai-score";
import { parseApplicationInput, toPublicJob } from "../../../../lib/recruiting/job-fields";
import { notifyNewRecruitingApplication } from "../../../../lib/recruiting/notify-new-application";
import { sendRecruitingTemplateEmail } from "../../../../lib/recruiting/send-recruiting-email";

type Context = { params: Promise<{ slug: string }> };
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function publicJob(slug: string) {
  if (!slugPattern.test(slug) || slug.length > 80) return null;
  return prisma.recruitingJob.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      department: { select: { nameEn: true, nameDe: true, nameIt: true } },
      hotelTenant: { select: { dataProtectionEn: true, dataProtectionDe: true, dataProtectionIt: true, privacyPolicyEn: true, privacyPolicyDe: true, privacyPolicyIt: true } },
    },
  });
}

function campaignCodeFrom(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 32) : "";
}

async function readApplyBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    const body = await request.json().catch(() => null);
    return { body, cvFile: null as File | null };
  }
  const form = await request.formData().catch(() => null);
  if (!form) return { body: null, cvFile: null as File | null };
  const cv = form.get("cv");
  const cvFile = cv instanceof File && cv.size > 0 ? cv : null;
  let answers: unknown = [];
  const answersRaw = form.get("answers");
  if (typeof answersRaw === "string" && answersRaw.trim()) {
    try { answers = JSON.parse(answersRaw); } catch { answers = []; }
  }
  return {
    cvFile,
    body: {
      locale: form.get("locale"),
      salutation: form.get("salutation"),
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      email: form.get("email"),
      phone: form.get("phone"),
      message: form.get("message"),
      cvFileName: cvFile?.name || form.get("cvFileName"),
      keepForOtherJobs: form.get("keepForOtherJobs") === "true" || form.get("keepForOtherJobs") === "1",
      campaignCode: form.get("campaignCode"),
      answers,
    },
  };
}

export async function GET(request: Request, context: Context) {
  const { slug } = await context.params;
  const job = await publicJob(slug);
  if (!job) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale") ?? "";
  const click = url.searchParams.get("click") === "1";
  const campaignCode = campaignCodeFrom(url.searchParams.get("c"));
  const current = click
    ? await prisma.recruitingJob.update({ where: { id: job.id }, data: { clickCount: { increment: 1 } } })
    : job;
  if (click && campaignCode) {
    await incrementCampaignClicks(campaignCode, job.id).catch((error) => console.error("Campaign click failed", error));
  }
  const apps = await prisma.recruitingApplication.count({ where: { jobId: current.id } });
  const hotel = job.hotelTenant;
  return Response.json({ job: { ...toPublicJob(current, apps, locale, true, job.department), policies: { dataProtection: { en: hotel?.dataProtectionEn ?? "", de: hotel?.dataProtectionDe ?? "", it: hotel?.dataProtectionIt ?? "" }, privacyPolicy: { en: hotel?.privacyPolicyEn ?? "", de: hotel?.privacyPolicyDe ?? "", it: hotel?.privacyPolicyIt ?? "" } } } }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, context: Context) {
  const { slug } = await context.params;
  const job = await publicJob(slug);
  if (!job) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const format = job.format.toLowerCase() as "classic" | "quiz";
  const { body, cvFile } = await readApplyBody(request);
  const input = parseApplicationInput(body, format, job.cvRequired);
  if (!input) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  let cvFileName = input.cvFileName;
  if (cvFile) {
    const saved = await saveRecruitingCv(cvFile);
    if (!saved) return Response.json({ error: "INVALID_CV" }, { status: 400 });
    cvFileName = packCvRef(saved.storageKey, saved.originalName);
  } else if (job.cvRequired) {
    return Response.json({ error: "INVALID_CV" }, { status: 400 });
  }
  const campaignCode = campaignCodeFrom(body && typeof body === "object" ? (body as Record<string, unknown>).campaignCode : "");
  const campaign = campaignCode
    ? await incrementCampaignApplications(campaignCode, job.id).catch((error) => {
      console.error("Campaign application failed", error);
      return null;
    })
    : null;
  const notes = campaign
    ? notesPayload([], [], [], {
      code: campaign.code,
      source: campaign.source,
      name: campaign.name,
      team: campaign.team,
    })
    : undefined;
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.recruitingApplication.create({
      data: {
        hotelTenantId: job.hotelTenantId,
        jobId: job.id,
        locale: input.locale,
        salutation: input.salutation,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        message: input.message,
        cvFileName,
        keepForOtherJobs: input.keepForOtherJobs,
        answers: input.answers,
        ...(notes ? { notes: notes as Prisma.InputJsonValue } : {}),
      },
    });
    await notifyNewRecruitingApplication(tx, {
      hotelTenantId: job.hotelTenantId,
      applicationId: row.id,
      job,
      applicant: row,
    });
    return row;
  });
  void sendRecruitingTemplateEmail({
    hotelTenantId: job.hotelTenantId,
    category: "received",
    applicationId: created.id,
  }).catch((error) => console.error("Received email failed", error));
  void dispatchRecruitingAiScore(job.hotelTenantId, created.id).catch((error) => console.error("Recruiting AI score dispatch failed", error));
  return Response.json({ id: created.id }, { status: 201 });
}
