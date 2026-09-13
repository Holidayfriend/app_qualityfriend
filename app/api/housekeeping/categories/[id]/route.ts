import { recordAuditLog } from "../../../../../lib/audit/audit-service";
import { categoryAuditSnapshot } from "../../../../../lib/housekeeping/settings-audit";
import { accessibleModules } from "../../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../../lib/auth/session";
import { prisma } from "../../../../../lib/prisma";

type Context = { params: Promise<{ id: string }> };
type Locale = "en" | "de" | "it";
type Frequency = "DAILY" | "EVERY_SECOND_DAY" | "WEEKLY" | "ON_REQUEST";
const frequencies = new Set<Frequency>(["DAILY", "EVERY_SECOND_DAY", "WEEKLY", "ON_REQUEST"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function actor() {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true } });
  if (!user) return null;
  return (await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role })).includes("housekeeping") ? user : null;
}
function locale(value: unknown): Locale { return value === "de" || value === "it" ? value : "en"; }
function validMinutes(value: unknown) { return value === null || typeof value === "number" && Number.isInteger(value) && value >= 0; }
function weekdays(value: unknown) { return Array.isArray(value) && value.every((day) => Number.isInteger(day) && day >= 1 && day <= 7) && new Set(value).size === value.length ? value as number[] : null; }

export async function GET(request: Request, context: Context) {
  const user = await actor();
  const { id } = await context.params;
  if (!user || !uuid.test(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const category = await prisma.roomCategory.findFirst({ where: { id, hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null }, select: { id: true, nameEn: true, nameDe: true, nameIt: true, expressMinutes: true, normalMinutes: true, departureMinutes: true, finalMinutes: true, cleaningFrequency: true, cleaningWeekdays: true, linenFrequency: true } });
  if (!category) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const activeLocale = locale(new URL(request.url).searchParams.get("locale"));
  const name = activeLocale === "de" ? category.nameDe || category.nameEn : activeLocale === "it" ? category.nameIt || category.nameEn : category.nameEn;
  return Response.json({ category: { ...category, name } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request, context: Context) {
  const user = await actor();
  const { id } = await context.params;
  if (!user || !uuid.test(id)) return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const activeLocale = locale(body?.locale);
  const expressMinutes = body?.expressMinutes, normalMinutes = body?.normalMinutes, departureMinutes = body?.departureMinutes, finalMinutes = body?.finalMinutes;
  const cleaningFrequency = body?.cleaningFrequency, linenFrequency = body?.linenFrequency, selectedWeekdays = weekdays(body?.cleaningWeekdays);
  if (!name || name.length > 180 || ![expressMinutes, normalMinutes, departureMinutes, finalMinutes].every(validMinutes) || !frequencies.has(cleaningFrequency as Frequency) || !frequencies.has(linenFrequency as Frequency) || selectedWeekdays === null || cleaningFrequency === "ON_REQUEST" && selectedWeekdays.length === 0) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const cleaningWeekdays = cleaningFrequency === "ON_REQUEST" ? [...selectedWeekdays].sort((a, b) => a - b) : [];
  const translatedName = activeLocale === "en" ? { nameEn: name } : activeLocale === "de" ? { nameDe: name } : { nameIt: name };
  const updated = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM room_categories WHERE id = ${id}::uuid AND hotel_tenant_id = ${user.hotelTenantId}::uuid FOR UPDATE`;
    const where = { id, hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null };
    const before = await tx.roomCategory.findFirst({ where });
    if (!before) return false;
    const after = await tx.roomCategory.update({ where, data: { ...translatedName, expressMinutes: expressMinutes as number | null, normalMinutes: normalMinutes as number | null, departureMinutes: departureMinutes as number | null, finalMinutes: finalMinutes as number | null, cleaningFrequency: cleaningFrequency as Frequency, cleaningWeekdays, linenFrequency: linenFrequency as Frequency } });
    await recordAuditLog(tx, { hotelTenantId: user.hotelTenantId, actorId: user.id, action: "UPDATE", entityType: "ROOM_CATEGORY", entityId: id, changes: { before: categoryAuditSnapshot(before), after: categoryAuditSnapshot(after) } });
    return true;
  });
  return updated ? Response.json({ success: true }) : Response.json({ error: "NOT_FOUND" }, { status: 404 });
}
