import { randomUUID } from "node:crypto";
import { Prisma } from "../../../../../../app/generated/prisma/client";
import { recordAuditLog } from "../../../../../../lib/audit/audit-service";
import { accessibleModules } from "../../../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../../../lib/auth/session";
import { prisma } from "../../../../../../lib/prisma";

type Context = { params: Promise<{ id: string }> };
type ChecklistType = "ROOM" | "ARRIVAL";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hotelDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function values(input: unknown) { return Array.isArray(input) ? input.filter((value): value is string => typeof value === "string") : []; }

async function actor() {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true, firstName: true, lastName: true, hotelTenant: { select: { timeZone: true } } } });
  return user && (await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role })).includes("housekeeping") ? user : null;
}

export async function POST(request: Request, context: Context) {
  const user = await actor();
  const { id: roomId } = await context.params;
  if (!user) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!uuid.test(roomId)) return Response.json({ error: "INVALID_ROOM_ID" }, { status: 400 });
  const body = await request.json().catch(() => null) as { type?: unknown; index?: unknown; checked?: unknown } | null;
  const type: ChecklistType | null = body?.type === "ROOM" || body?.type === "ARRIVAL" ? body.type : null;
  const index = typeof body?.index === "number" && Number.isInteger(body.index) && body.index >= 0 ? body.index : -1;
  if (!type || index < 0 || typeof body?.checked !== "boolean") return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  let workDate: string;
  try { workDate = hotelDate(user.hotelTenant.timeZone?.trim() || "UTC"); } catch { return Response.json({ error: "INVALID_HOTEL_TIME_ZONE" }, { status: 500 }); }
  const room = await prisma.room.findFirst({ where: { id: roomId, hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null }, select: { id: true, number: true, checklistTemplate: true } });
  if (!room) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const checklist = room.checklistTemplate;
  const en = values(type === "ROOM" ? checklist?.roomChecksEn : checklist?.arrivalChecksEn);
  const de = values(type === "ROOM" ? checklist?.roomChecksDe : checklist?.arrivalChecksDe);
  const it = values(type === "ROOM" ? checklist?.roomChecksIt : checklist?.arrivalChecksIt);
  if (!en[index] && !de[index] && !it[index]) return Response.json({ error: "CHECK_NOT_FOUND" }, { status: 404 });
  const text = { en: en[index] || de[index] || it[index], de: de[index] || en[index] || it[index], it: it[index] || en[index] || de[index] };
  const actorName = `${user.firstName} ${user.lastName}`.trim() || "User";
  const result = await prisma.$transaction(async (tx) => {
    if (!body.checked) {
      const deleted = await tx.$queryRaw<{ id: string }[]>`DELETE FROM housekeeping_checklist_completions WHERE hotel_tenant_id=${user.hotelTenantId}::uuid AND room_id=${room.id}::uuid AND work_date=${workDate}::date AND checklist_type=${type}::"HousekeepingChecklistType" AND check_index=${index} RETURNING id`;
      if (deleted.length) await recordAuditLog(tx, { hotelTenantId: user.hotelTenantId, actorId: user.id, action: "STATUS_CHANGE", entityType: "HOUSEKEEPING_CHECK", entityId: deleted[0].id, changes: { roomNumber: room.number, workDate, type, checkIndex: index, checked: false, text } });
      return { checked: false, changed: Boolean(deleted.length) };
    }
    const created = await tx.$queryRaw<{ id: string }[]>`INSERT INTO housekeeping_checklist_completions (id,hotel_tenant_id,room_id,work_date,checklist_type,check_index,check_text_en,check_text_de,check_text_it,checked_by_id)
      VALUES (${randomUUID()}::uuid,${user.hotelTenantId}::uuid,${room.id}::uuid,${workDate}::date,${type}::"HousekeepingChecklistType",${index},${text.en},${text.de},${text.it},${user.id}::uuid)
      ON CONFLICT (hotel_tenant_id,work_date,room_id,checklist_type,check_index) DO NOTHING RETURNING id`;
    if (!created.length) return { checked: true, changed: false };
    await recordAuditLog(tx, { hotelTenantId: user.hotelTenantId, actorId: user.id, action: "STATUS_CHANGE", entityType: "HOUSEKEEPING_CHECK", entityId: created[0].id, changes: { roomNumber: room.number, workDate, type, checkIndex: index, checked: true, text } });
    await tx.notification.create({ data: { hotelTenantId: user.hotelTenantId, recipientId: user.id, moduleKey: "housekeeping", eventKey: `housekeeping-check:${created[0].id}`, icon: "housekeeping", destination: `/housekeeping/rooms/${room.id}`,
      titleEn: "Room check completed", titleDe: "Zimmerkontrolle erledigt", titleIt: "Controllo camera completato",
      bodyEn: `${actorName} marked “${text.en}” in room ${room.number}.`, bodyDe: `${actorName} hat „${text.de}“ in Zimmer ${room.number} markiert.`, bodyIt: `${actorName} ha contrassegnato “${text.it}” nella camera ${room.number}.`, requiredScope: "OWN" } });
    return { checked: true, changed: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return Response.json(result);
}
