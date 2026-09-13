import { recordAuditLog } from "../../../../../lib/audit/audit-service";
import { roomAuditSnapshot } from "../../../../../lib/housekeeping/settings-audit";
import { accessibleModules } from "../../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../../lib/auth/session";
import { prisma } from "../../../../../lib/prisma";

type Context = { params: Promise<{ id: string }> };
type Locale = "en" | "de" | "it";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const locale = (value: string | null): Locale => value === "de" || value === "it" ? value : "en";
const names = (activeLocale: Locale, item: { nameEn: string | null; nameDe: string | null; nameIt: string | null }) => activeLocale === "de" ? item.nameDe || item.nameEn || "" : activeLocale === "it" ? item.nameIt || item.nameEn || "" : item.nameEn || "";
async function actor() { const id = await getSessionUserId(); if (!id) return null; const user = await prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true } }); return user && (await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role })).includes("housekeeping") ? user : null; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

export async function GET(request: Request, context: Context) {
  const user = await actor(); const { id } = await context.params;
  if (!user || !uuid.test(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const activeLocale = locale(new URL(request.url).searchParams.get("locale"));
  const room = await prisma.room.findFirst({ where: { id, hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null }, include: { checklistTemplate: true } });
  if (!room) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const checklist = room.checklistTemplate;
  const roomChecks = activeLocale === "de" ? strings(checklist?.roomChecksDe) : activeLocale === "it" ? strings(checklist?.roomChecksIt) : strings(checklist?.roomChecksEn);
  const arrivalChecks = activeLocale === "de" ? strings(checklist?.arrivalChecksDe) : activeLocale === "it" ? strings(checklist?.arrivalChecksIt) : strings(checklist?.arrivalChecksEn);
  return Response.json({ room: { id: room.id, number: room.number, name: names(activeLocale, room), categoryId: room.categoryId, floorId: room.floorId, roomChecks, arrivalChecks } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: Context) {
  const user = await actor(); const { id } = await context.params;
  if (!user || !uuid.test(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const text = (key: string) => typeof body?.[key] === "string" ? body[key].trim() : "";
  const list = (key: string) => Array.isArray(body?.[key]) && body[key].every((value) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 180) ? (body[key] as string[]).map((value) => value.trim()) : null;
  const activeLocale = locale(typeof body?.locale === "string" ? body.locale : null), number = text("number"), name = text("name"), categoryId = text("categoryId") || null, floorId = text("floorId") || null, roomChecks = list("roomChecks"), arrivalChecks = list("arrivalChecks");
  if (!number || number.length > 40 || name.length > 180 || roomChecks === null || arrivalChecks === null) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const existing = await prisma.room.findFirst({ where: { id, hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null }, select: { id: true } });
  if (!existing) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const duplicate = await prisma.room.findFirst({ where: { hotelTenantId: user.hotelTenantId, number, id: { not: id } }, select: { id: true } });
  if (duplicate) return Response.json({ error: "ROOM_NUMBER_EXISTS" }, { status: 409 });
  const translation = activeLocale === "de" ? { nameDe: name } : activeLocale === "it" ? { nameIt: name } : { nameEn: name };
  const checklist = activeLocale === "de" ? { roomChecksDe: roomChecks, arrivalChecksDe: arrivalChecks } : activeLocale === "it" ? { roomChecksIt: roomChecks, arrivalChecksIt: arrivalChecks } : { roomChecksEn: roomChecks, arrivalChecksEn: arrivalChecks };
  const updated = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM rooms WHERE id = ${id}::uuid AND hotel_tenant_id = ${user.hotelTenantId}::uuid FOR UPDATE`;
    const where = { id, hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null };
    const before = await tx.room.findFirst({ where, include: { checklistTemplate: true } });
    if (!before) return false;
    const after = await tx.room.update({ where, data: { number, categoryId, floorId, ...translation } });
    const afterChecklist = await tx.roomChecklistTemplate.upsert({ where: { roomId: id }, update: checklist, create: { hotelTenantId: user.hotelTenantId, roomId: id, roomChecksEn: activeLocale === "en" ? roomChecks : [], roomChecksDe: activeLocale === "de" ? roomChecks : [], roomChecksIt: activeLocale === "it" ? roomChecks : [], arrivalChecksEn: activeLocale === "en" ? arrivalChecks : [], arrivalChecksDe: activeLocale === "de" ? arrivalChecks : [], arrivalChecksIt: activeLocale === "it" ? arrivalChecks : [] } });
    await recordAuditLog(tx, { hotelTenantId: user.hotelTenantId, actorId: user.id, action: "UPDATE", entityType: "ROOM", entityId: id, changes: { before: roomAuditSnapshot(before, before.checklistTemplate), after: roomAuditSnapshot(after, afterChecklist) } });
    return true;
  });
  if (!updated) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  return Response.json({ success: true });
}
