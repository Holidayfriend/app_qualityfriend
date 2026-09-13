import { Prisma } from "../../../../app/generated/prisma/client";
import { accessibleModules } from "../../../../lib/auth/module-access";
import { getSessionUserId } from "../../../../lib/auth/session";
import { prisma } from "../../../../lib/prisma";

type Locale = "en" | "de" | "it";
type AssignmentRow = { id: string; assigned_to_id: string; item_id: string; planned_minutes: number; completed_at: Date | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const locale = (value: string | null): Locale => value === "de" || value === "it" ? value : "en";
const translated = (activeLocale: Locale, item: { descriptionEn: string; descriptionDe: string; descriptionIt: string }) => activeLocale === "de" ? item.descriptionDe || item.descriptionEn : activeLocale === "it" ? item.descriptionIt || item.descriptionEn : item.descriptionEn;
function hotelDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts();
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
const asDate = (value: string) => new Date(`${value}T00:00:00.000Z`);

async function actor() {
  const id = await getSessionUserId();
  if (!id) return null;
  const user = await prisma.user.findFirst({ where: { id, isActive: true, isDeleted: false }, select: { id: true, hotelTenantId: true, role: true, hotelTenant: { select: { timeZone: true } } } });
  return user && (await accessibleModules({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role })).includes("housekeeping") ? user : null;
}

async function housekeepingUsers(hotelTenantId: string) {
  const users = await prisma.user.findMany({ where: { hotelTenantId, isActive: true, isDeleted: false }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], select: { id: true, firstName: true, lastName: true, role: true } });
  const access = await Promise.all(users.map(async (user) => ({ user, allowed: (await accessibleModules({ id: user.id, hotel_tenant_id: hotelTenantId, role: user.role })).includes("housekeeping") })));
  return access.filter((entry) => entry.allowed).map((entry) => entry.user);
}

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const activeLocale = locale(new URL(request.url).searchParams.get("locale"));
  const timeZone = user.hotelTenant.timeZone?.trim() || "UTC";
  let date: string;
  try { date = hotelDate(timeZone); } catch { return Response.json({ error: "INVALID_HOTEL_TIME_ZONE" }, { status: 500 }); }
  const day = asDate(date);
  const [eligibleUsers, rooms, extras, roomAssignments, extraAssignments] = await Promise.all([
    housekeepingUsers(user.hotelTenantId),
    prisma.room.findMany({
      where: { hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null, reservationRoomStayRecords: { some: { arrivalDate: { lte: day }, departureDate: { gte: day }, reservation: { sourcePresent: true, status: { notIn: ["CANCELLED", "NO_SHOW"] } } } } },
      orderBy: { number: "asc" }, select: { id: true, number: true, category: { select: { normalMinutes: true } }, floor: { select: { id: true, code: true, nameEn: true, nameDe: true, nameIt: true, sortOrder: true } } },
    }),
    prisma.extraJob.findMany({ where: { hotelTenantId: user.hotelTenantId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.$queryRaw<AssignmentRow[]>`SELECT id,assigned_to_id,item_id,planned_minutes,completed_at FROM (SELECT id,assigned_to_id,room_id AS item_id,planned_minutes,completed_at FROM housekeeping_room_assignments WHERE hotel_tenant_id=${user.hotelTenantId}::uuid AND work_date=${date}::date) assignments`,
    prisma.$queryRaw<AssignmentRow[]>`SELECT id,assigned_to_id,item_id,planned_minutes,completed_at FROM (SELECT id,assigned_to_id,extra_job_id AS item_id,planned_minutes,completed_at FROM housekeeping_extra_job_assignments WHERE hotel_tenant_id=${user.hotelTenantId}::uuid AND work_date=${date}::date) assignments`,
  ]);
  const employeeWorkload = eligibleUsers.map((employee) => {
    const assignedRooms = roomAssignments.filter((assignment) => assignment.assigned_to_id === employee.id);
    const assignedExtras = extraAssignments.filter((assignment) => assignment.assigned_to_id === employee.id);
    return { id: employee.id, name: `${employee.firstName} ${employee.lastName}`.trim(), role: employee.role, capacityMinutes: 480,
      assignedMinutes: [...assignedRooms, ...assignedExtras].reduce((sum, assignment) => sum + assignment.planned_minutes, 0),
      completedMinutes: [...assignedRooms, ...assignedExtras].filter((assignment) => assignment.completed_at).reduce((sum, assignment) => sum + assignment.planned_minutes, 0),
      roomIds: assignedRooms.map((assignment) => assignment.item_id), extraJobIds: assignedExtras.map((assignment) => assignment.item_id) };
  });
  return Response.json({ date, timeZone, employees: employeeWorkload,
    floors: [...new Map(rooms.filter((room) => room.floor).map((room) => [room.floor!.id, room.floor!])).values()].sort((a, b) => a.sortOrder - b.sortOrder).map((floor) => ({ id: floor.id, code: floor.code, name: (activeLocale === "de" ? floor.nameDe || floor.nameEn : activeLocale === "it" ? floor.nameIt || floor.nameEn : floor.nameEn) || floor.code,
      rooms: rooms.filter((room) => room.floor?.id === floor.id).map((room) => ({ id: room.id, number: room.number, plannedMinutes: room.category?.normalMinutes ?? 0, assignedToId: roomAssignments.find((assignment) => assignment.item_id === room.id)?.assigned_to_id ?? null })) })),
    extras: extras.map((extra) => ({ id: extra.id, description: translated(activeLocale, extra), minutes: extra.minutes, assignedToIds: extraAssignments.filter((assignment) => assignment.item_id === extra.id).map((assignment) => assignment.assigned_to_id) })),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const user = await actor();
  if (!user) return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  const body = await request.json().catch(() => null) as { employeeId?: unknown; roomIds?: unknown; extraJobIds?: unknown } | null;
  const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "";
  const roomIds = Array.isArray(body?.roomIds) && body.roomIds.every((id) => typeof id === "string" && uuid.test(id)) ? [...new Set(body.roomIds as string[])] : null;
  const extraJobIds = Array.isArray(body?.extraJobIds) && body.extraJobIds.every((id) => typeof id === "string" && uuid.test(id)) ? [...new Set(body.extraJobIds as string[])] : null;
  if (!uuid.test(employeeId) || !roomIds || !extraJobIds) return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  const eligibleUsers = await housekeepingUsers(user.hotelTenantId);
  if (!eligibleUsers.some((employee) => employee.id === employeeId)) return Response.json({ error: "INVALID_EMPLOYEE" }, { status: 400 });
  const timeZone = user.hotelTenant.timeZone?.trim() || "UTC";
  let date: string;
  try { date = hotelDate(timeZone); } catch { return Response.json({ error: "INVALID_HOTEL_TIME_ZONE" }, { status: 500 }); }
  const day = asDate(date);
  const [rooms, extras] = await Promise.all([
    prisma.room.findMany({ where: { id: { in: roomIds }, hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null, reservationRoomStayRecords: { some: { arrivalDate: { lte: day }, departureDate: { gte: day }, reservation: { sourcePresent: true, status: { notIn: ["CANCELLED", "NO_SHOW"] } } } } }, select: { id: true, category: { select: { normalMinutes: true } } } }),
    prisma.extraJob.findMany({ where: { id: { in: extraJobIds }, hotelTenantId: user.hotelTenantId }, select: { id: true, minutes: true } }),
  ]);
  if (rooms.length !== roomIds.length || extras.length !== extraJobIds.length) return Response.json({ error: "INVALID_ASSIGNMENT_ITEM" }, { status: 400 });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`DELETE FROM housekeeping_room_assignments WHERE hotel_tenant_id=${user.hotelTenantId}::uuid AND work_date=${date}::date AND assigned_to_id=${employeeId}::uuid`;
      await tx.$executeRaw`DELETE FROM housekeeping_extra_job_assignments WHERE hotel_tenant_id=${user.hotelTenantId}::uuid AND work_date=${date}::date AND assigned_to_id=${employeeId}::uuid`;
      for (const room of rooms) await tx.$executeRaw`INSERT INTO housekeeping_room_assignments (id,hotel_tenant_id,work_date,room_id,assigned_to_id,planned_minutes,updated_at) VALUES (${crypto.randomUUID()}::uuid,${user.hotelTenantId}::uuid,${date}::date,${room.id}::uuid,${employeeId}::uuid,${room.category?.normalMinutes ?? 0},NOW())`;
      for (const extra of extras) await tx.$executeRaw`INSERT INTO housekeeping_extra_job_assignments (id,hotel_tenant_id,work_date,extra_job_id,assigned_to_id,planned_minutes,updated_at) VALUES (${crypto.randomUUID()}::uuid,${user.hotelTenantId}::uuid,${date}::date,${extra.id}::uuid,${employeeId}::uuid,${extra.minutes},NOW())`;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "ROOM_ALREADY_ASSIGNED" }, { status: 409 });
    throw error;
  }
  return Response.json({ success: true });
}
