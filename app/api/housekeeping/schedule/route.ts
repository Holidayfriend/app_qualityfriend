import { Prisma } from "../../../../app/generated/prisma/client";
import { housekeepingAccess } from "../../../../lib/housekeeping/access";
import { getSessionUserId } from "../../../../lib/auth/session";
import { prisma } from "../../../../lib/prisma";
import { cleaningPlan } from "../../../../lib/housekeeping/daily-plan";

type Locale = "en" | "de" | "it";
type AssignmentRow = { id: string; assigned_to_id: string | null; item_id: string; planned_minutes: number; completed_at: Date | null };
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
  return user && (await housekeepingAccess({ id: user.id, hotel_tenant_id: user.hotelTenantId, role: user.role })).admin ? user : null;
}

async function housekeepingUsers(hotelTenantId: string) {
  const users = await prisma.user.findMany({ where: { hotelTenantId, isActive: true, isDeleted: false }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], select: { id: true, firstName: true, lastName: true, role: true } });
  const access = await Promise.all(users.map(async (user) => ({ user, allowed: user.role !== "ADMIN" && (await housekeepingAccess({ id: user.id, hotel_tenant_id: hotelTenantId, role: user.role })).housekeeper })));
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
  const body = await request.json().catch(() => null) as { employeeId?: unknown; itemId?: unknown; itemType?: unknown; mode?: unknown; assigned?: unknown } | null;
  const employeeId = typeof body?.employeeId === "string" ? body.employeeId : "", itemId = typeof body?.itemId === "string" ? body.itemId : "";
  const itemType = body?.itemType === "room" || body?.itemType === "extra" ? body.itemType : null;
  const mode = body?.mode === "PERMANENT" || body?.mode === "TODAY_ONLY" ? body.mode : null;
  if (!uuid.test(employeeId) || !uuid.test(itemId) || !itemType || !mode || typeof body?.assigned !== "boolean") return Response.json({ error: "INVALID_FIELDS" }, { status: 400 });
  if (!(await housekeepingUsers(user.hotelTenantId)).some((employee) => employee.id === employeeId)) return Response.json({ error: "INVALID_EMPLOYEE" }, { status: 400 });
  let date: string;
  try { date = hotelDate(user.hotelTenant.timeZone?.trim() || "UTC"); } catch { return Response.json({ error: "INVALID_HOTEL_TIME_ZONE" }, { status: 500 }); }
  const day = asDate(date);
  try {
    if (itemType === "room") {
      const room = await prisma.room.findFirst({ where: { id: itemId, hotelTenantId: user.hotelTenantId, isActive: true, archivedAt: null }, select: { id: true, category: { select: { normalMinutes: true, expressMinutes: true, departureMinutes: true, cleaningFrequency: true, cleaningWeekdays: true } }, reservationRoomStayRecords: { where: { arrivalDate: { lte: day }, departureDate: { gte: day }, reservation: { sourcePresent: true, status: { notIn: ["CANCELLED", "NO_SHOW"] } } }, orderBy: { arrivalDate: "desc" }, take: 1, select: { id: true, arrivalDate: true, departureDate: true } } } });
      const stay = room?.reservationRoomStayRecords[0];
      if (!room || !stay) return Response.json({ error: "INVALID_ASSIGNMENT_ITEM" }, { status: 400 });
      const category = room.category;
      const plan = cleaningPlan({ arrival_date: stay.arrivalDate.toISOString().slice(0, 10), departure_date: stay.departureDate.toISOString().slice(0, 10), normal_minutes: category?.normalMinutes ?? null, express_minutes: category?.expressMinutes ?? null, departure_minutes: category?.departureMinutes ?? null, cleaning_frequency: category?.cleaningFrequency ?? null, cleaning_weekdays: category?.cleaningWeekdays ?? [] }, date);
      await prisma.$transaction(async (tx) => {
        if (body.assigned) {
          if (mode === "PERMANENT") await tx.$executeRaw`INSERT INTO housekeeping_permanent_room_assignments (id,hotel_tenant_id,room_id,assigned_to_id,updated_at) VALUES (${crypto.randomUUID()}::uuid,${user.hotelTenantId}::uuid,${itemId}::uuid,${employeeId}::uuid,NOW()) ON CONFLICT (hotel_tenant_id,room_id) DO UPDATE SET assigned_to_id=EXCLUDED.assigned_to_id,updated_at=NOW()`;
          await tx.$executeRaw`INSERT INTO housekeeping_room_assignments (id,hotel_tenant_id,work_date,room_id,assigned_to_id,reservation_stay_id,cleaning_type,assignment_origin,planned_minutes,updated_at) VALUES (${crypto.randomUUID()}::uuid,${user.hotelTenantId}::uuid,${date}::date,${itemId}::uuid,${employeeId}::uuid,${stay.id}::uuid,${plan.type}::"HousekeepingCleaningType",${mode}::"HousekeepingAssignmentOrigin",${plan.minutes},NOW()) ON CONFLICT (hotel_tenant_id,work_date,room_id) DO UPDATE SET assigned_to_id=EXCLUDED.assigned_to_id,assignment_origin=EXCLUDED.assignment_origin,reservation_stay_id=EXCLUDED.reservation_stay_id,cleaning_type=EXCLUDED.cleaning_type,planned_minutes=EXCLUDED.planned_minutes,updated_at=NOW()`;
        } else {
          if (mode === "PERMANENT") await tx.$executeRaw`DELETE FROM housekeeping_permanent_room_assignments WHERE hotel_tenant_id=${user.hotelTenantId}::uuid AND room_id=${itemId}::uuid AND assigned_to_id=${employeeId}::uuid`;
          await tx.$executeRaw`UPDATE housekeeping_room_assignments SET assigned_to_id=NULL,assignment_origin='TODAY_ONLY',updated_at=NOW() WHERE hotel_tenant_id=${user.hotelTenantId}::uuid AND work_date=${date}::date AND room_id=${itemId}::uuid AND assigned_to_id=${employeeId}::uuid AND completed_at IS NULL`;
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } else {
      const extra = await prisma.extraJob.findFirst({ where: { id: itemId, hotelTenantId: user.hotelTenantId }, select: { id: true, minutes: true, descriptionEn: true, descriptionDe: true, descriptionIt: true } });
      if (!extra) return Response.json({ error: "INVALID_ASSIGNMENT_ITEM" }, { status: 400 });
      const description = extra.descriptionEn || extra.descriptionDe || extra.descriptionIt;
      await prisma.$transaction(async (tx) => {
        if (body.assigned) {
          if (mode === "PERMANENT") await tx.$executeRaw`INSERT INTO housekeeping_permanent_extra_job_assignments (id,hotel_tenant_id,extra_job_id,assigned_to_id,updated_at) VALUES (${crypto.randomUUID()}::uuid,${user.hotelTenantId}::uuid,${itemId}::uuid,${employeeId}::uuid,NOW()) ON CONFLICT (hotel_tenant_id,extra_job_id,assigned_to_id) DO NOTHING`;
          await tx.$executeRaw`INSERT INTO housekeeping_extra_job_assignments (id,hotel_tenant_id,work_date,extra_job_id,assigned_to_id,planned_minutes,assignment_origin,description_snapshot,updated_at) VALUES (${crypto.randomUUID()}::uuid,${user.hotelTenantId}::uuid,${date}::date,${itemId}::uuid,${employeeId}::uuid,${extra.minutes},${mode}::"HousekeepingAssignmentOrigin",${description},NOW()) ON CONFLICT (hotel_tenant_id,work_date,extra_job_id,assigned_to_id) DO UPDATE SET assignment_origin=EXCLUDED.assignment_origin,planned_minutes=EXCLUDED.planned_minutes,description_snapshot=EXCLUDED.description_snapshot,updated_at=NOW()`;
        } else {
          if (mode === "PERMANENT") await tx.$executeRaw`DELETE FROM housekeeping_permanent_extra_job_assignments WHERE hotel_tenant_id=${user.hotelTenantId}::uuid AND extra_job_id=${itemId}::uuid AND assigned_to_id=${employeeId}::uuid`;
          await tx.$executeRaw`DELETE FROM housekeeping_extra_job_assignments WHERE hotel_tenant_id=${user.hotelTenantId}::uuid AND work_date=${date}::date AND extra_job_id=${itemId}::uuid AND assigned_to_id=${employeeId}::uuid AND completed_at IS NULL`;
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "ROOM_ALREADY_ASSIGNED" }, { status: 409 });
    throw error;
  }
  return Response.json({ success: true });
}
