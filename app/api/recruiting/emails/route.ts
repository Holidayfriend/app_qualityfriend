import { Prisma } from "../../../../app/generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { recordAuditLog } from "../../../../lib/audit/audit-service";
import { recruitingActor } from "../../../../lib/recruiting/access";
import {
  emailTemplatesAuditSnapshot,
  flattenEmailTemplates,
  parseEmailTemplatesInput,
  seedEmailTemplateRows,
  toPublicEmailAuto,
  toPublicEmailTemplates,
} from "../../../../lib/recruiting/email-template-fields";

async function ensureHotelTemplates(hotelTenantId: string) {
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

export async function GET() {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const rows = await ensureHotelTemplates(actor.hotel_tenant_id);
  return Response.json({
    templates: toPublicEmailTemplates(rows),
    auto: toPublicEmailAuto(rows),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = parseEmailTemplatesInput(await request.json().catch(() => null));
  if (!parsed) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    const beforeRows = await tx.recruitingEmailTemplate.findMany({ where: { hotelTenantId: actor.hotel_tenant_id } });
    const before = { templates: toPublicEmailTemplates(beforeRows), auto: toPublicEmailAuto(beforeRows) };
    for (const row of flattenEmailTemplates(parsed.templates, parsed.auto)) {
      await tx.recruitingEmailTemplate.upsert({
        where: {
          hotelTenantId_category_locale: {
            hotelTenantId: actor.hotel_tenant_id,
            category: row.category,
            locale: row.locale,
          },
        },
        create: { hotelTenantId: actor.hotel_tenant_id, ...row },
        update: { subject: row.subject, body: row.body, autoSend: row.autoSend },
      });
    }
    const afterRows = await tx.recruitingEmailTemplate.findMany({ where: { hotelTenantId: actor.hotel_tenant_id } });
    const after = { templates: toPublicEmailTemplates(afterRows), auto: toPublicEmailAuto(afterRows) };
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: beforeRows.length ? "UPDATE" : "CREATE",
      entityType: "RECRUITING_EMAIL_TEMPLATE",
      entityId: afterRows[0]?.id ?? null,
      changes: beforeRows.length
        ? { before: emailTemplatesAuditSnapshot(before.templates, before.auto), after: emailTemplatesAuditSnapshot(after.templates, after.auto) }
        : { after: emailTemplatesAuditSnapshot(after.templates, after.auto) },
    });
    return after;
  });
  return Response.json(result);
}
