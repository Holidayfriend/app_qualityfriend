import { recordAuditLog } from "../../../../lib/audit/audit-service";
import { roomAuditSnapshot } from "../../../../lib/housekeeping/settings-audit";
import { accessibleModules } from "../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../lib/auth/session";
import { prisma } from "../../../../lib/prisma";

type Locale = "en" | "de" | "it";
function locale(value: string | null): Locale { return value === "de" || value === "it" ? value : "en"; }
function translatedName(item: { nameEn: string | null; nameDe: string | null; nameIt: string | null }, activeLocale: Locale) {
  return activeLocale === "de" ? item.nameDe || item.nameEn : activeLocale === "it" ? item.nameIt || item.nameEn : item.nameEn;
}
function localDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
function utcDate(value: string) { return new Date(`${value}T00:00:00.000Z`); }

export async function GET(request: Request) {
  const id = await getSessionUserId();
  if (!id) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true, hotelTenant: { select: { timeZone: true } } } });
  if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!(await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role })).includes("housekeeping")) return Response.json({ error: "FORBIDDEN" }, { status: 403 });

  if (new URL(request.url).searchParams.get("summary") === "1") {
    const where = { hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null };
    const [totalRooms, totalFloors] = await Promise.all([
      prisma.room.count({ where }),
      prisma.floor.count({ where }),
    ]);
    return Response.json({ totalRooms, totalFloors }, { headers: { "Cache-Control": "no-store" } });
  }

  const activeLocale = locale(new URL(request.url).searchParams.get("locale"));
  if (new URL(request.url).searchParams.get("board") === "1") {
    const configuredZone = user.hotelTenant.timeZone?.trim() || "UTC";
    let date: string;
    try { date = localDate(configuredZone); } catch { return Response.json({ error: "INVALID_HOTEL_TIME_ZONE" }, { status: 500 }); }
    const day = utcDate(date);
    const floors = await prisma.floor.findMany({
      where: { hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
      select: { id: true, code: true, nameEn: true, nameDe: true, nameIt: true, roomRecords: {
        where: { isActive: true, archivedAt: null, reservationRoomStayRecords: { some: {
          arrivalDate: { lte: day }, departureDate: { gte: day },
          reservation: { sourcePresent: true, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
        } } }, orderBy: { number: "asc" }, select: {
          id: true, number: true, reservationRoomStayRecords: { where: {
            arrivalDate: { lte: day }, departureDate: { gte: day },
            reservation: { sourcePresent: true, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
          }, orderBy: { arrivalDate: "asc" }, select: { arrivalDate: true, departureDate: true, sourceStatus: true, serviceRemarks: true,
            sourceFromRoomNumber: true, sourceToRoomNumber: true },
          },
        },
      } },
    });
    return Response.json({ date, timeZone: configuredZone, floors: floors.map((floor) => ({
      id: floor.id, code: floor.code, name: translatedName(floor, activeLocale) || floor.code,
      rooms: floor.roomRecords.map((room) => {
        const stays = room.reservationRoomStayRecords;
        const primaryStay = stays[stays.length - 1];
        return { id: room.id, number: room.number, status: "clean" as const,
          arrival: stays.some((stay) => stay.arrivalDate.getTime() === day.getTime()),
          departure: stays.some((stay) => stay.departureDate.getTime() === day.getTime()),
          checkedIn: stays.some((stay) => stay.sourceStatus === "occupied"),
          checkedOut: stays.some((stay) => stay.sourceStatus === "departed"),
          fromRooms: [...new Set(stays.filter((stay) => stay.arrivalDate.getTime() === day.getTime()).map((stay) => stay.sourceFromRoomNumber).filter((value): value is string => Boolean(value)))],
          toRooms: [...new Set(stays.filter((stay) => stay.departureDate.getTime() === day.getTime()).map((stay) => stay.sourceToRoomNumber).filter((value): value is string => Boolean(value)))],
          hasReservationNote: Boolean(primaryStay?.serviceRemarks?.trim()),
        };
      }),
    })) }, { headers: { "Cache-Control": "no-store" } });
  }
  if (new URL(request.url).searchParams.get("form") === "1") {
    const [categories, floors] = await Promise.all([
      prisma.roomCategory.findMany({ where: { hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null }, orderBy: { nameEn: "asc" }, select: { id: true, nameEn: true, nameDe: true, nameIt: true } }),
      prisma.floor.findMany({ where: { hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { code: "asc" }], select: { id: true, code: true, nameEn: true, nameDe: true, nameIt: true } }),
    ]);
    return Response.json({ categories: categories.map((category) => ({ id: category.id, name: translatedName(category, activeLocale) })), floors: floors.map((floor) => ({ id: floor.id, name: translatedName(floor, activeLocale) || floor.code })) }, { headers: { "Cache-Control": "no-store" } });
  }
  const rooms = await prisma.room.findMany({
    where: { hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      nameEn: true,
      nameDe: true,
      nameIt: true,
      category: { select: { nameEn: true, nameDe: true, nameIt: true } },
      floor: { select: { code: true, nameEn: true, nameDe: true, nameIt: true } },
    },
  });

  return Response.json({
    rooms: rooms.map((room) => ({
      id: room.id,
      number: room.number,
      name: translatedName(room, activeLocale),
      category: room.category ? translatedName(room.category, activeLocale) : null,
      floor: room.floor ? translatedName(room.floor, activeLocale) || room.floor.code : null,
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const id = await getSessionUserId();
  if (!id) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  const user = await prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true } });
  if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  if (!(await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role })).includes("housekeeping")) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const input = await roomInput(request);
  if ("error" in input) return Response.json(input, { status: 400 });
  const duplicate = await prisma.room.findFirst({ where: { hotelTenantId: user.hotelTenantId, number: input.number }, select: { id: true } });
  if (duplicate) return Response.json({ error: "ROOM_NUMBER_EXISTS" }, { status: 409 });
  const room = await prisma.$transaction(async tx => {
    const created = await tx.room.create({ data: { hotelTenantId: user.hotelTenantId, ...input.room, checklistTemplate: { create: { hotelTenantId: user.hotelTenantId, ...input.checklist } } }, include: { checklistTemplate: true } });
    await recordAuditLog(tx, { hotelTenantId: user.hotelTenantId, actorId: user.id, action: "CREATE", entityType: "ROOM", entityId: created.id, changes: { after: roomAuditSnapshot(created, created.checklistTemplate) } });
    return created;
  });
  return Response.json({ id: room.id }, { status: 201 });
}

async function roomInput(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const string = (key: string) => typeof body?.[key] === "string" ? body[key].trim() : "";
  const list = (key: string) => Array.isArray(body?.[key]) && body[key].every((value) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= 180) ? (body[key] as string[]).map((value) => value.trim()) : null;
  const activeLocale = locale(typeof body?.locale === "string" ? body.locale : null);
  const number = string("number"), name = string("name"), categoryId = string("categoryId") || null, floorId = string("floorId") || null;
  const roomChecks = list("roomChecks"), arrivalChecks = list("arrivalChecks");
  if (!number || number.length > 40 || name.length > 180 || roomChecks === null || arrivalChecks === null) return { error: "INVALID_FIELDS" as const };
  const nameFields = activeLocale === "de" ? { nameEn: name || null, nameDe: name || null, nameIt: null } : activeLocale === "it" ? { nameEn: name || null, nameDe: null, nameIt: name || null } : { nameEn: name || null, nameDe: null, nameIt: null };
  const checklist = activeLocale === "de" ? { roomChecksEn: roomChecks, roomChecksDe: roomChecks, roomChecksIt: [], arrivalChecksEn: arrivalChecks, arrivalChecksDe: arrivalChecks, arrivalChecksIt: [] } : activeLocale === "it" ? { roomChecksEn: roomChecks, roomChecksDe: [], roomChecksIt: roomChecks, arrivalChecksEn: arrivalChecks, arrivalChecksDe: [], arrivalChecksIt: arrivalChecks } : { roomChecksEn: roomChecks, roomChecksDe: [], roomChecksIt: [], arrivalChecksEn: arrivalChecks, arrivalChecksDe: [], arrivalChecksIt: [] };
  return { number, room: { number, categoryId, floorId, ...nameFields }, checklist };
}
