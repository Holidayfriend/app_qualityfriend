import { prisma } from "../../../../../lib/prisma";
import { roleAdministrator, validRoleName } from "../../../../../lib/settings/hotel-roles";
import { translateEntityName } from "../../../../../lib/settings/translate";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";

export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const actor = await roleAdministrator();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { key } = await params;
  const where = { hotelTenantId_key: { hotelTenantId: actor.hotelTenantId, key } };
  const role = await prisma.hotelRole.findUnique({ where });
  if (!role) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  if (role.isSystem) return Response.json({ error: "SYSTEM_ROLE" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!validRoleName(body?.name) || !["en", "de", "it"].includes(body?.locale)) {
    return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  }
  const names = await translateEntityName(actor.hotelTenantId, body.locale, body.name, "user role");
  const updated = await prisma.$transaction(async (tx) => {
    const previous = await tx.hotelRole.findUnique({ where });
    if (!previous || previous.isSystem) return null;
    // Only labels change: the stable key, user assignments and permissions stay intact.
    const result = await tx.hotelRole.update({ where, data: { nameEn: names.en, nameDe: names.de, nameIt: names.it } });
    await recordAuditLog(tx, { module: "settings", hotelTenantId: actor.hotelTenantId, actorId: actor.id, action: "UPDATE", entityType: "HOTEL_ROLE", entityId: key, changes: { before: { en: previous.nameEn, de: previous.nameDe, it: previous.nameIt }, after: names } });
    return result;
  });
  return updated ? Response.json(updated) : Response.json({ error: "NOT_FOUND" }, { status: 404 });
}
