import { prisma } from "../../../../lib/prisma";
import { recordAuditLog } from "../../../../lib/audit/audit-service";
import { recruitingActor } from "../../../../lib/recruiting/access";
import { parseJobInput, toPublicJob, uniqueSlug } from "../../../../lib/recruiting/job-fields";

const departmentSelect = { select: { nameEn: true, nameDe: true, nameIt: true } } as const;

export async function GET(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const jobs = await prisma.recruitingJob.findMany({
    where: { hotelTenantId: actor.hotel_tenant_id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } }, department: departmentSelect },
  });
  return Response.json({ jobs: jobs.map((job) => toPublicJob(job, job._count.applications, locale, false, job.department)) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const input = parseJobInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const department = await prisma.department.findFirst({
    where: { id: input.departmentId, hotelTenantId: actor.hotel_tenant_id, isDeleted: false, isActive: true },
    select: { id: true, nameEn: true, nameDe: true, nameIt: true },
  });
  if (!department) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const job = await prisma.$transaction(async (tx) => {
    const slug = await uniqueSlug(async (value) => !!(await tx.recruitingJob.findUnique({ where: { slug: value }, select: { id: true } })), input.title);
    const created = await tx.recruitingJob.create({
      data: {
        hotelTenantId: actor.hotel_tenant_id,
        slug,
        title: input.title,
        titleDe: input.title,
        titleIt: input.title,
        format: input.format,
        status: input.status,
        departmentId: department.id,
        workType: input.workType,
        startFrom: input.startFrom,
        notes: input.notes,
        description: input.description,
        descriptionDe: input.description,
        descriptionIt: input.description,
        autoMessage: input.autoMessage,
        autoMessageDe: input.autoMessage,
        autoMessageIt: input.autoMessage,
        location: input.location,
        locationDe: input.location,
        locationIt: input.location,
        cvRequired: input.cvRequired,
        languages: input.languages,
        listingImage: input.listingImage,
        logoImage: input.logoImage,
        quiz: input.quiz,
      },
    });
    await recordAuditLog(tx, { hotelTenantId: actor.hotel_tenant_id, actorId: actor.id, action: "CREATE", entityType: "RECRUITING_JOB", entityId: created.id, changes: { after: { title: created.title, format: created.format, slug: created.slug } } });
    return created;
  });
  return Response.json({ job: toPublicJob(job, 0, undefined, true, department) }, { status: 201 });
}
