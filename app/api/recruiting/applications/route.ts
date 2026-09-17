import { prisma } from "../../../../lib/prisma";
import { recordAuditLog } from "../../../../lib/audit/audit-service";
import { recruitingActor } from "../../../../lib/recruiting/access";
import { parseManualApplication, toPublicApplicant } from "../../../../lib/recruiting/application-fields";
import { packCvRef, saveRecruitingCv } from "../../../../lib/recruiting/cv-storage";
import { dispatchRecruitingAiScore } from "../../../../lib/recruiting/dispatch-ai-score";

const jobInclude = {
  select: {
    title: true,
    titleDe: true,
    titleIt: true,
    format: true,
    department: { select: { nameEn: true, nameDe: true, nameIt: true } },
  },
} as const;

async function readManualBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return { body: await request.json().catch(() => null), cvFile: null as File | null };
  }
  const form = await request.formData().catch(() => null);
  if (!form) return { body: null, cvFile: null as File | null };
  const cv = form.get("cv");
  const cvFile = cv instanceof File && cv.size > 0 ? cv : null;
  return {
    cvFile,
    body: {
      jobId: form.get("jobId"),
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      email: form.get("email"),
      phone: form.get("phone"),
      message: form.get("message"),
      cvFileName: cvFile?.name || form.get("cvFileName"),
      locale: form.get("locale"),
    },
  };
}

export async function GET(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const rows = await prisma.recruitingApplication.findMany({
    where: { hotelTenantId: actor.hotel_tenant_id },
    orderBy: { createdAt: "desc" },
    include: { job: jobInclude },
  });
  const applications = rows.map((row) => toPublicApplicant(row, row.job, locale));
  return Response.json({ applications }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { body, cvFile } = await readManualBody(request);
  const input = parseManualApplication(body);
  if (!input) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  let cvFileName = input.cvFileName;
  if (cvFile) {
    const saved = await saveRecruitingCv(cvFile);
    if (!saved) return Response.json({ error: "INVALID_CV" }, { status: 400 });
    cvFileName = packCvRef(saved.storageKey, saved.originalName);
  }
  const job = await prisma.recruitingJob.findFirst({
    where: { id: input.jobId, hotelTenantId: actor.hotel_tenant_id },
    include: { department: { select: { nameEn: true, nameDe: true, nameIt: true } } },
  });
  if (!job) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.recruitingApplication.create({
      data: {
        hotelTenantId: actor.hotel_tenant_id,
        jobId: job.id,
        stage: "NEW",
        locale: input.locale,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        message: input.message,
        cvFileName,
        keepForOtherJobs: false,
        answers: [],
      },
      include: { job: jobInclude },
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "CREATE",
      entityType: "RECRUITING_APPLICATION",
      entityId: row.id,
      changes: { after: { name: `${row.firstName} ${row.lastName}`, jobId: row.jobId } },
    });
    return row;
  });
  void dispatchRecruitingAiScore(actor.hotel_tenant_id, created.id).catch((error) => console.error("Recruiting AI score dispatch failed", error));
  return Response.json({
    application: toPublicApplicant(created, created.job, input.locale, { source: "manual" }),
  }, { status: 201 });
}
