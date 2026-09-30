import { randomUUID } from "node:crypto";
import { prisma } from "../../../../lib/prisma";
import { hotelRoles, roleAdministrator, validRoleName } from "../../../../lib/settings/hotel-roles";
import { editableModuleKeys, resolveRoleModules } from "../../../../lib/auth/role-policy";
import { recordAuditLog } from "../../../../lib/audit/audit-service";

export async function GET() {
  const actor = await roleAdministrator();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  return Response.json(await hotelRoles(actor.hotelTenantId), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const actor = await roleAdministrator();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!validRoleName(body?.nameEn) || !validRoleName(body?.nameDe) || !validRoleName(body?.nameIt)) {
    return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  }
  const names = { nameEn: body.nameEn.trim(), nameDe: body.nameDe.trim(), nameIt: body.nameIt.trim() };
  // Keys are server-generated; a custom name can never confer administrator authority.
  const key = randomUUID();
  const role = await prisma.$transaction(async (tx) => {
    const employeePermissions = await tx.roleModulePermission.findMany({ where: { hotelTenantId: actor.hotelTenantId, role: "EMPLOYEE" } });
    const access = new Set(resolveRoleModules("EMPLOYEE", employeePermissions));
    const created = await tx.hotelRole.create({ data: { hotelTenantId: actor.hotelTenantId, key, ...names } });
    await tx.roleModulePermission.createMany({ data: editableModuleKeys.map((moduleKey) => ({ hotelTenantId: actor.hotelTenantId, role: key, moduleKey, canView: access.has(moduleKey) })) });
    await recordAuditLog(tx, { hotelTenantId: actor.hotelTenantId, actorId: actor.id, action: "CREATE", entityType: "HOTEL_ROLE", entityId: key, changes: { after: { en: names.nameEn, de: names.nameDe, it: names.nameIt } } });
    return created;
  });
  return Response.json(role, { status: 201 });
}
