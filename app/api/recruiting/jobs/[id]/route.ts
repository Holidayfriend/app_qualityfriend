import { prisma } from "../../../../../lib/prisma";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";
import { recruitingActor } from "../../../../../lib/recruiting/access";
import { listingStatuses, toPublicJob } from "../../../../../lib/recruiting/job-fields";
import type { RecruitingJobStatus } from "../../../../../app/generated/prisma/client";

type Context = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const after = await tx.recruitingJob.update({ where: { id }, data: { status } });
    await recordAuditLog(tx, { hotelTenantId: actor.hotel_tenant_id, actorId: actor.id, action: "STATUS_CHANGE", entityType: "RECRUITING_JOB", entityId: id, changes: { before: { status: before.status }, after: { status: after.status } } });
    return after;
  });
  if (!updated) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const apps = await prisma.recruitingApplication.count({ where: { jobId: updated.id } });
  return Response.json({ job: toPublicJob(updated, apps) });
}
