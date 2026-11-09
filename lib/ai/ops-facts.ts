import type { PrismaClient, ReservationStatus } from "../../app/generated/prisma/client";
import { hotelTimeZone } from "../hotel/clock";
import { hotelLocalDate } from "../housekeeping/daily-plan";
import { housekeepingDashboardSummary, occupancyPercent } from "../housekeeping/dashboard-summary";
import { addDaysIso } from "../schedule/week";
import type { OpsFacts, OpsPerson, OpsTask, OpsTaskRank } from "./ops-briefing-text";

const closedReservationStatuses: ReservationStatus[] = ["CANCELLED", "NO_SHOW"];

function utcDay(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function personName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`.trim();
}

function clock(value: Date | null, timeZone: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(value);
}

function taskRank(due: string, asOf: string): OpsTaskRank {
  if (!due) return "none";
  if (due < asOf) return "overdue";
  if (due === asOf) return "today";
  const [year, month, day] = asOf.split("-").map(Number);
  const soon = new Date(Date.UTC(year, (month || 1) - 1, (day || 1) + 7)).toISOString().slice(0, 10);
  if (due <= soon) return "soon";
  return "later";
}

function isoDate(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export async function collectOpsFacts(prisma: PrismaClient, hotelTenantId: string): Promise<OpsFacts> {
  const hotel = await prisma.hotelTenant.findFirst({
    where: { id: hotelTenantId },
    select: { timeZone: true },
  });
  if (!hotel) throw new Error("Hotel not found");
  const timeZone = hotelTimeZone(hotel.timeZone);
  const asOf = hotelLocalDate(timeZone);
  const tomorrow = addDaysIso(asOf, 1);
  const day = utcDay(asOf);
  const next = utcDay(tomorrow);
  const liveReservation = { sourcePresent: true, status: { notIn: closedReservationStatuses } };
  const liveRoom = { isActive: true, archivedAt: null };

  const [rooms, capacity, occupied, arrivalRows, departureRows, vipRows, tasks, extraJobs] = await Promise.all([
    prisma.room.findMany({
      where: {
        hotelTenantId,
        isActive: true,
        archivedAt: null,
        reservationRoomStayRecords: { some: { arrivalDate: { lte: day }, departureDate: { gte: day }, reservation: liveReservation } },
      },
      select: {
        number: true,
        roomOperationalStateRecords: { take: 1, select: { cleanliness: true, noService: true, isExpress: true, expressDeadline: true } },
        housekeepingScheduleAssignmentRecords: { where: { workDate: day }, take: 1, select: { cleaningType: true } },
      },
    }),
    prisma.room.count({ where: { hotelTenantId, isActive: true, archivedAt: null } }),
    prisma.reservationRoomStay.findMany({
      where: { hotelTenantId, arrivalDate: { lte: day }, departureDate: { gt: day }, reservation: liveReservation, room: liveRoom },
      distinct: ["roomId"],
      select: { roomId: true },
    }),
    prisma.reservationRoomStay.findMany({
      where: { hotelTenantId, arrivalDate: day, reservation: liveReservation, room: liveRoom },
      distinct: ["roomId"],
      select: { roomId: true },
    }),
    prisma.reservationRoomStay.findMany({
      where: { hotelTenantId, departureDate: day, reservation: liveReservation, room: liveRoom },
      distinct: ["roomId"],
      select: { roomId: true },
    }),
    prisma.reservationGuest.findMany({
      where: { hotelTenantId, vip: true, roomStay: { arrivalDate: day, reservation: liveReservation, room: liveRoom } },
      select: { name: true, roomStay: { select: { room: { select: { number: true } } } } },
      take: 8,
    }),
    prisma.hotelTask.findMany({
      where: { hotelTenantId, status: "OPEN" },
      select: {
        title: true,
        dueAt: true,
        assignee: { select: { firstName: true, lastName: true } },
        department: { select: { nameEn: true } },
        departments: { select: { department: { select: { nameEn: true } } } },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
      take: 40,
    }),
    prisma.housekeepingExtraJobAssignment.findMany({
      where: { hotelTenantId, workDate: day, completedAt: null },
      select: {
        descriptionSnapshot: true,
        extraJob: { select: { descriptionEn: true } },
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      take: 8,
    }),
  ]);

  let shifts: Array<{ workDate: Date; kind: string; user: { firstName: string; lastName: string } }> = [];
  try {
    shifts = await prisma.hotelShift.findMany({
      where: {
        hotelTenantId,
        workDate: { in: [day, next] },
        kind: { in: ["OFF", "VACATION"] },
        user: { isDeleted: false, isActive: true },
      },
      select: { workDate: true, kind: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: [{ user: { lastName: "asc" } }],
    });
  } catch (error) {
    console.error("ops briefing shifts unavailable", error);
  }

  const summary = housekeepingDashboardSummary(rooms.map((room) => {
    const state = room.roomOperationalStateRecords[0];
    return {
      number: room.number,
      cleanliness: state?.cleanliness ?? null,
      noService: state?.noService ?? false,
      isExpress: Boolean(state?.isExpress) || room.housekeepingScheduleAssignmentRecords[0]?.cleaningType === "EXPRESS",
    };
  }));
  const deadlineByRoom = new Map(rooms.map((room) => {
    const state = room.roomOperationalStateRecords[0];
    return [room.number, clock(state?.expressDeadline ?? null, timeZone)] as const;
  }));
  const absent = (date: string): OpsPerson[] => shifts
    .filter((row) => isoDate(row.workDate) === date)
    .map((row) => ({ name: personName(row.user.firstName, row.user.lastName), kind: row.kind === "VACATION" ? "vac" as const : "off" as const }))
    .filter((row) => row.name);

  const openTasks: OpsTask[] = tasks.map((task) => {
    const due = isoDate(task.dueAt);
    const departments = [
      task.department?.nameEn ?? "",
      ...task.departments.map((row) => row.department.nameEn),
    ].map((name) => name.trim()).filter(Boolean);
    return {
      title: task.title.trim(),
      due,
      rank: taskRank(due, asOf),
      assignee: task.assignee ? personName(task.assignee.firstName, task.assignee.lastName) : "",
      department: [...new Set(departments)].join(", "),
    };
  }).filter((task) => task.title);

  return {
    asOf,
    arrivals: arrivalRows.length,
    departures: departureRows.length,
    vipArrivals: vipRows.map((guest) => ({ room: guest.roomStay.room.number, name: guest.name.trim() })).filter((guest) => guest.room || guest.name),
    expressRooms: summary.expressRooms.map((number) => ({ number, deadline: deadlineByRoom.get(number) ?? "" })),
    noServiceRooms: summary.noServiceRooms,
    occupancy: occupancyPercent(occupied.length, capacity),
    absentToday: absent(asOf),
    absentTomorrow: absent(tomorrow),
    openTasks,
    openExtraJobs: extraJobs.map((job) => ({
      title: (job.descriptionSnapshot.trim() || job.extraJob.descriptionEn.trim()).slice(0, 120),
      assignee: personName(job.assignedTo.firstName, job.assignedTo.lastName),
    })).filter((job) => job.title),
  };
}
