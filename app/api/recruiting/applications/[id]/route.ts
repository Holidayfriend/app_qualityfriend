import { prisma } from "../../../../../lib/prisma";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";
import { recruitingActor } from "../../../../../lib/recruiting/access";
import { isUuid, toDbStage, toPublicApplicant } from "../../../../../lib/recruiting/application-fields";

type Context = { params: Promise<{ id: string }> };

const jobInclude = {
  select: {
    title: true,
    titleDe: true,
    titleIt: true,
    format: true,
    department: { select: { nameEn: true, nameDe: true, nameIt: true } },
  },
} as const;

export async function GET(request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  if (!isUuid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const row = await prisma.recruitingApplication.findFirst({
    where: { id, hotelTenantId: actor.hotel_tenant_id },
    include: { job: jobInclude },
  });
  if (!row) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ application: toPublicApplicant(row, row.job, locale) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const stageRaw = body && typeof body === "object" ? (body as { stage?: string }).stage : undefined;
  const stage = typeof stageRaw === "string" ? toDbStage(stageRaw) : null;
  if (!stage) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const locale = body && typeof body === "object" && typeof (body as { locale?: unknown }).locale === "string"
    ? (body as { locale: string }).locale
    : "";
  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.recruitingApplication.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id } });
    if (!before) return null;
    const after = await tx.recruitingApplication.update({
      where: { id },
      data: { stage },
      include: { job: jobInclude },
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: "STATUS_CHANGE",
      entityType: "RECRUITING_APPLICATION",
      entityId: id,
      changes: { before: { stage: before.stage }, after: { stage: after.stage } },
    });
    return after;
  });
  if (!updated) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ application: toPublicApplicant(updated, updated.job, locale) });
}
