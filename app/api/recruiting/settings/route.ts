import { Prisma } from "../../../../app/generated/prisma/client";
import { prisma } from "../../../../lib/prisma";
import { recordAuditLog } from "../../../../lib/audit/audit-service";
import { recruitingActor } from "../../../../lib/recruiting/access";
import { emptyRecruitingSettings, parseSettingsInput, settingsAuditSnapshot, toPublicSettings } from "../../../../lib/recruiting/settings-fields";

export async function GET() {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const row = await prisma.recruitingSettings.findUnique({ where: { hotelTenantId: actor.hotel_tenant_id } });
  return Response.json({ settings: row ? toPublicSettings(row) : emptyRecruitingSettings() }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const parsed = parseSettingsInput(await request.json().catch(() => null));
  if (!parsed) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  if (parsed === "INVALID_SUBDOMAIN") return Response.json({ error: "INVALID_SUBDOMAIN" }, { status: 400 });
  if (parsed === "INVALID_EMAIL") return Response.json({ error: "INVALID_EMAIL" }, { status: 400 });
  if (parsed === "INVALID_LOGO") return Response.json({ error: "INVALID_LOGO" }, { status: 400 });
  try {
    const settings = await prisma.$transaction(async (tx) => {
      const before = await tx.recruitingSettings.findUnique({ where: { hotelTenantId: actor.hotel_tenant_id } });
      const data = { subdomain: parsed.subdomain || null, replyEmail: parsed.replyEmail, emailLogo: parsed.emailLogo };
      const after = before
        ? await tx.recruitingSettings.update({ where: { hotelTenantId: actor.hotel_tenant_id }, data })
        : await tx.recruitingSettings.create({ data: { hotelTenantId: actor.hotel_tenant_id, ...data } });
      await recordAuditLog(tx, {
        hotelTenantId: actor.hotel_tenant_id,
        actorId: actor.id,
        action: before ? "UPDATE" : "CREATE",
        entityType: "RECRUITING_SETTINGS",
        entityId: after.id,
        changes: {
          before: before ? settingsAuditSnapshot(toPublicSettings(before)) : undefined,
          after: settingsAuditSnapshot(toPublicSettings(after)),
        },
      });
      return after;
    });
    return Response.json({ settings: toPublicSettings(settings) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "SUBDOMAIN_TAKEN" }, { status: 409 });
    }
    throw error;
  }
}
