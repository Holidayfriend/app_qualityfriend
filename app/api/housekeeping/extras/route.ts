import { translateEntityName } from "../../../../lib/settings/translate";
import { prisma } from "../../../../lib/prisma";
import { recordAuditLog } from "../../../../lib/audit/audit-service";
import { extraJobActor } from "../../../../lib/housekeeping/extra-job-access";
import { localizeExtraJobInput, extraJobDescription, extraJobInput, extraJobSnapshot, isExtraLocale } from "../../../../lib/housekeeping/extra-job-fields";

export async function GET(request: Request) {
  const actor = await extraJobActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "en";
  if (!isExtraLocale(locale)) return Response.json({ error: "INVALID_LOCALE" }, { status: 400 });
  const jobs = await prisma.extraJob.findMany({ where: { hotelTenantId: actor.hotel_tenant_id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  return Response.json({ extras: jobs.map(job => ({ id: job.id, description: extraJobDescription(job, locale), minutes: job.minutes })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await extraJobActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const input = extraJobInput(await request.json().catch(() => null));
  if (!input) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const data = await localizeExtraJobInput(input, (locale, description) => translateEntityName(actor.hotel_tenant_id, locale, description, "housekeeping additional job"));
  const job = await prisma.$transaction(async tx => {
    const created = await tx.extraJob.create({ data: { hotelTenantId: actor.hotel_tenant_id, ...data } });
    await recordAuditLog(tx, { hotelTenantId: actor.hotel_tenant_id, actorId: actor.id, action: "CREATE", entityType: "EXTRA_JOB", entityId: created.id, changes: { locale: input.locale, after: extraJobSnapshot(created) } });
    return created;
  });
  return Response.json({ id: job.id }, { status: 201 });
}
