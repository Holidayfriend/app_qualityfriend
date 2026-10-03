import { translateEntityName } from "../../../../../lib/settings/translate";
import { prisma } from "../../../../../lib/prisma";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";
import { extraJobActor } from "../../../../../lib/housekeeping/extra-job-access";
import { localizeExtraJobInput, extraJobDescription, extraJobInput, extraJobSnapshot, isExtraLocale } from "../../../../../lib/housekeeping/extra-job-fields";

type Context = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: Context) {
  const actor = await extraJobActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!uuid.test(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "en";
  if (!isExtraLocale(locale)) return Response.json({ error: "INVALID_LOCALE" }, { status: 400 });
  const job = await prisma.extraJob.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id } });
  if (!job) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ extra: { id: job.id, description: extraJobDescription(job, locale), minutes: job.minutes } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: Context) {
  const actor = await extraJobActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!uuid.test(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const input = extraJobInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  if (!await prisma.extraJob.findFirst({ where: { id, hotelTenantId: actor.hotel_tenant_id }, select: { id: true } })) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const data = await localizeExtraJobInput(input, (locale, description) => translateEntityName(actor.hotel_tenant_id, locale, description, "housekeeping additional job"));
  const updated = await prisma.$transaction(async tx => {
    // Serialize edits so the audit's before snapshot also reflects concurrent saves.
    await tx.$queryRaw`SELECT id FROM extra_jobs WHERE id = ${id}::uuid AND hotel_tenant_id = ${actor.hotel_tenant_id}::uuid FOR UPDATE`;
    const where = { id, hotelTenantId: actor.hotel_tenant_id };
    const before = await tx.extraJob.findFirst({ where });
    if (!before) return false;
    const after = await tx.extraJob.update({ where, data });
    await recordAuditLog(tx, { hotelTenantId: actor.hotel_tenant_id, actorId: actor.id, action: "UPDATE", entityType: "EXTRA_JOB", entityId: id, changes: { locale: input.locale, before: extraJobSnapshot(before), after: extraJobSnapshot(after) } });
    return true;
  });
  return updated ? Response.json({ success: true }) : Response.json({ error: "NOT_FOUND" }, { status: 404 });
}
