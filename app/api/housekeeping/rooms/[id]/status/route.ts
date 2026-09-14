import { randomUUID } from "node:crypto";
import { Prisma } from "../../../../../../app/generated/prisma/client";
import { recordAuditLog } from "../../../../../../lib/audit/audit-service";
import { accessibleModules } from "../../../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../../../lib/auth/session";
import { prisma } from "../../../../../../lib/prisma";

type Context = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cleanliness = { unassigned: "UNKNOWN", dirty: "DIRTY", cleaning: "CLEANING", clean: "CLEAN", inspected: "INSPECTED", inspectionInProgress: "CLEANING", noCleaningDesired: "DIRTY" } as const;

function hotelDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function actor() {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true, hotelTenant: { select: { timeZone: true } } } });
  return user && (await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role })).includes("housekeeping") ? user : null;
}

export async function PATCH(request: Request, context: Context) {
  const user = await actor();
  const { id: roomId } = await context.params;
  if (!user) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!uuid.test(roomId)) return Response.json({ error: "INVALID_ROOM_ID" }, { status: 400 });
  const body = await request.json().catch(() => null) as { status?: unknown; breakfastInRoom?: unknown; doNotDisturb?: unknown; noService?: unknown } | null;
  const status = typeof body?.status === "string" && body.status in cleanliness ? body.status as keyof typeof cleanliness : null;
  if (!status || typeof body?.breakfastInRoom !== "boolean" || typeof body?.doNotDisturb !== "boolean" || typeof body?.noService !== "boolean") return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  let workDate: string;
  try { workDate = hotelDate(user.hotelTenant.timeZone?.trim() || "UTC"); } catch { return Response.json({ error: "INVALID_HOTEL_TIME_ZONE" }, { status: 500 }); }
  const room = await prisma.room.findFirst({ where: { id: roomId, hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null }, select: { id: true, number: true } });
  if (!room) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const target = cleanliness[status];
  const noService = status === "noCleaningDesired" || body.noService;
  await prisma.$transaction(async (tx) => {
    const before = await tx.roomOperationalState.findFirst({ where: { hotelTenantId: user.hotelTenantId, roomId: room.id }, select: { cleanliness: true, breakfastInRoom: true, doNotDisturb: true, noService: true } });
    await tx.$executeRaw`INSERT INTO room_operational_states (id,hotel_tenant_id,room_id,cleanliness,breakfast_in_room,do_not_disturb,no_service,last_cleaned_at,updated_at)
      VALUES (${randomUUID()}::uuid,${user.hotelTenantId}::uuid,${room.id}::uuid,${target}::"RoomCleanliness",${body.breakfastInRoom},${body.doNotDisturb},${noService},${target === "CLEAN" ? new Date() : null},NOW())
      ON CONFLICT (hotel_tenant_id,room_id) DO UPDATE SET cleanliness=EXCLUDED.cleanliness,breakfast_in_room=EXCLUDED.breakfast_in_room,do_not_disturb=EXCLUDED.do_not_disturb,no_service=EXCLUDED.no_service,
      last_cleaned_at=CASE WHEN EXCLUDED.cleanliness='CLEAN' THEN NOW() ELSE room_operational_states.last_cleaned_at END,updated_at=NOW()`;
    if (target === "CLEAN") await tx.$executeRaw`UPDATE housekeeping_room_assignments SET completed_at=COALESCE(completed_at,NOW()),updated_at=NOW()
      WHERE hotel_tenant_id=${user.hotelTenantId}::uuid AND room_id=${room.id}::uuid AND work_date=${workDate}::date AND assigned_to_id IS NOT NULL`;
    else if (target === "DIRTY" || target === "CLEANING" || target === "UNKNOWN") await tx.$executeRaw`UPDATE housekeeping_room_assignments SET completed_at=NULL,updated_at=NOW()
      WHERE hotel_tenant_id=${user.hotelTenantId}::uuid AND room_id=${room.id}::uuid AND work_date=${workDate}::date AND completed_at IS NOT NULL`;
    await recordAuditLog(tx, { hotelTenantId: user.hotelTenantId, actorId: user.id, action: "STATUS_CHANGE", entityType: "ROOM", entityId: room.id, changes: { roomNumber: room.number, workDate, before, after: { cleanliness: target, breakfastInRoom: body.breakfastInRoom, doNotDisturb: body.doNotDisturb, noService }, assignmentCompleted: target === "CLEAN" } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return Response.json({ success: true, status });
}
