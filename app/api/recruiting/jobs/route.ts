import { prisma } from "../../../../lib/prisma";
import { recordAuditLog } from "../../../../lib/audit/audit-service";
import { recruitingActor } from "../../../../lib/recruiting/access";
import { parseJobInput, toPublicJob, uniqueSlug } from "../../../../lib/recruiting/job-fields";

export async function GET() {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const jobs = await prisma.recruitingJob.findMany({
    where: { hotelTenantId: actor.hotel_tenant_id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { applications: true } } },
  });
  return Response.json({ jobs: jobs.map((job) => toPublicJob(job, job._count.applications, undefined, false)) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const input = parseJobInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const job = await prisma.$transaction(async (tx) => {
    const slug = await uniqueSlug(async (value) => !!(await tx.recruitingJob.findUnique({ where: { slug: value }, select: { id: true } })), input.title);
    const created = await tx.recruitingJob.create({
      data: {
        hotelTenantId: actor.hotel_tenant_id,
        slug,
        title: input.title,
        format: input.format,
        status: input.status,
        department: input.department,
        workType: input.workType,
        startFrom: input.startFrom,
        notes: input.notes,
        description: input.description,
        autoMessage: input.autoMessage,
        location: input.location,
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
  return Response.json({ job: toPublicJob(job, 0) }, { status: 201 });
}
