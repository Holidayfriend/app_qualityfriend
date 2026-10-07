import { prisma } from "../../../../../lib/prisma";
import { recordAuditLog } from "../../../../../lib/audit/audit-service";
import { hotelTimeZoneFor } from "../../../../../lib/hotel/context";
import { recruitingActor } from "../../../../../lib/recruiting/access";
import {
  employeeAuditSnapshot,
  isEmployeeUuid,
  parseEmployeePatch,
  toPublicEmployee,
} from "../../../../../lib/recruiting/employee-fields";

type Context = { params: Promise<{ id: string }> };

const departmentSelect = { select: { nameEn: true, nameDe: true, nameIt: true } } as const;

export async function GET(request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  if (!isEmployeeUuid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const row = await prisma.recruitingEmployee.findFirst({
    where: { id, hotelTenantId: actor.hotel_tenant_id },
    include: { department: departmentSelect },
  });
  if (!row) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ employee: toPublicEmployee(row, locale, await hotelTimeZoneFor(actor.hotel_tenant_id)) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: Context) {
  const actor = await recruitingActor();
  if (!actor) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await context.params;
  if (!isEmployeeUuid(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const locale = new URL(request.url).searchParams.get("locale") ?? "";
  const patch = parseEmployeePatch(await request.json().catch(() => null));
  if (!patch) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });

  const updated = await prisma.$transaction(async (tx) => {
    const before = await tx.recruitingEmployee.findFirst({
      where: { id, hotelTenantId: actor.hotel_tenant_id },
      include: { department: departmentSelect },
    });
    if (!before) return null;
    if (patch.departmentId) {
      const department = await tx.department.findFirst({
        where: { id: patch.departmentId, hotelTenantId: actor.hotel_tenant_id, isDeleted: false, isActive: true },
        select: { id: true },
      });
      if (!department) return null;
    }
    const employedFrom = patch.employedFrom !== undefined ? patch.employedFrom : before.employedFrom;
    const employedTo = patch.employedTo !== undefined ? patch.employedTo : before.employedTo;
    if (employedFrom && employedTo && employedTo < employedFrom) return "END_BEFORE_START" as const;
    const after = await tx.recruitingEmployee.update({
      where: { id },
      data: patch,
      include: { department: departmentSelect },
    });
    await recordAuditLog(tx, {
      hotelTenantId: actor.hotel_tenant_id,
      actorId: actor.id,
      action: patch.status && patch.status !== before.status ? "STATUS_CHANGE" : "UPDATE",
      entityType: "RECRUITING_EMPLOYEE",
      entityId: id,
      changes: { before: employeeAuditSnapshot(before), after: employeeAuditSnapshot(after) },
    });
    return after;
  });
  if (updated === "END_BEFORE_START") return Response.json({ error: "END_BEFORE_START" }, { status: 400 });
  if (!updated) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ employee: toPublicEmployee(updated, locale || undefined, await hotelTimeZoneFor(actor.hotel_tenant_id)) });
}
