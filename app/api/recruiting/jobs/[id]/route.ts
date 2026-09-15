import { prisma } from "../../../../../lib/prisma";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";
import { recruitingActor } from "../../../../../lib/recruiting/access";
import { jobAuditSnapshot, listingStatuses, localeFieldPatch, parseJobInput, toPublicJob } from "../../../../../lib/recruiting/job-fields";
import type { RecruitingJobStatus } from "../../../../../app/generated/prisma/client";

type Context = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const departmentSelect = { select: { nameEn: true, nameDe: true, nameIt: true } } as const;

export async function GET(request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!uuid.test(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const job = await prisma.recruitingJob.findFirst({
    where: { id, hotelTenantId: actor.hotel_tenant_id },
    include: { department: departmentSelect, _count: { select: { applications: true } } },
  });
  if (!job) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ job: toPublicJob(job, job._count.applications, locale, true, job.department) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!uuid.test(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const input = parseJobInput(body);
  if (!input) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const locale = body && typeof body === "object" && typeof (body as { locale?: unknown }).locale === "string" ? (body as { locale: string }).locale : "en";
  const department = await prisma.department.findFirst({
    where: { id: input.departmentId, hotelTenantId: actor.hotel_tenant_id, isDeleted: false, isActive: true },
    select: { id: true, nameEn: true, nameDe: true, nameIt: true },
  });
  if (!department) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.recruitingJob.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id } });
    if (!existing) return null;
    const after = await tx.recruitingJob.update({
      where: { id },
      data: {
        ...localeFieldPatch(locale, {
          title: input.title,
          description: input.description,
          autoMessage: input.autoMessage,
          location: input.location,
        }),
        status: input.status,
        departmentId: department.id,
        workType: input.workType,
        startFrom: input.startFrom,
        notes: input.notes,
        cvRequired: input.cvRequired,
        languages: input.languages,
        listingImage: input.listingImage,
        logoImage: input.logoImage,
        ...(existing.format === "QUIZ" ? { quiz: input.quiz } : {}),
      },
      include: { department: departmentSelect },
    });
    const statusChanged = existing.status !== after.status;
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: statusChanged ? "STATUS_CHANGE" : "UPDATE",
      entityType: "RECRUITING_JOB",
      entityId: id,
      changes: { locale, before: jobAuditSnapshot(existing), after: jobAuditSnapshot(after) },
    });
    return after;
  });
  if (!updated) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const apps = await prisma.recruitingApplication.count({ where: { jobId: updated.id } });
  return Response.json({ job: toPublicJob(updated, apps, locale, true, updated.department) });
}

export async function PATCH(request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!uuid.test(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const status = body && typeof body === "object" && listingStatuses.includes((body as { status?: string }).status as typeof listingStatuses[number])
    ? (body as { status: typeof listingStatuses[number] }).status.toUpperCase() as RecruitingJobStatus
    : null;
  if (!status) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const updated = await prisma.$transaction(async (tx) => {
    const where = { id, hotelTenantId: actor.hotel_tenant_id };
    const before = await tx.recruitingJob.findFirst({ where });
    if (!before) return null;
    const after = await tx.recruitingJob.update({ where: { id }, data: { status }, include: { department: departmentSelect } });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "STATUS_CHANGE",
      entityType: "RECRUITING_JOB",
      entityId: id,
      changes: { before: jobAuditSnapshot(before), after: jobAuditSnapshot(after) },
    });
    return after;
  });
  if (!updated) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const apps = await prisma.recruitingApplication.count({ where: { jobId: updated.id } });
  return Response.json({ job: toPublicJob(updated, apps, undefined, true, updated.department) });
}
