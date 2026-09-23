import "server-only";

import { prisma } from "../prisma";
import { addDaysIso } from "../schedule/week";
import { housekeepingDashboardSummary, occupancyPercent } from "./dashboard-summary";

const liveReservation = { sourcePresent: true, status: { notIn: ["CANCELLED", "NO_SHOW"] as const } };
const liveRoom = { isActive: true, archivedAt: null };

function utcDay(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

async function occupiedRoomCount(hotelTenantId: string, date: string) {
  const day = utcDay(date);
  const rows = await prisma.reservationRoomStay.findMany({
    where: {
      hotelTenantId,
      arrivalDate: { lte: day },
      departureDate: { gt: day },
      reservation: liveReservation,
      room: liveRoom,
    },
    distinct: ["roomId"],
    select: { roomId: true },
  });
  return rows.length;
}

async function movementRoomCount(hotelTenantId: string, date: string, field: "arrivalDate" | "departureDate") {
  const day = utcDay(date);
  const rows = await prisma.reservationRoomStay.findMany({
    where: {
      hotelTenantId,
      [field]: day,
      reservation: liveReservation,
      room: liveRoom,
    },
    distinct: ["roomId"],
    select: { roomId: true },
  });
  return rows.length;
}

export async function dashboardHousekeepingSnapshot(hotelTenantId: string, workDate: string) {
  const day = utcDay(workDate);
  const lastWeek = addDaysIso(workDate, -7);
  const [rooms, capacity, occupiedToday, occupiedLastWeek, arrivals, departures] = await Promise.all([
    prisma.room.findMany({
      where: {
        hotelTenantId,
        isActive: true,
        archivedAt: null,
        reservationRoomStayRecords: {
          some: {
            arrivalDate: { lte: day },
            departureDate: { gte: day },
            reservation: liveReservation,
          },
        },
      },
      select: {
        number: true,
        roomOperationalStateRecords: { take: 1, select: { cleanliness: true, noService: true, isExpress: true } },
        housekeepingScheduleAssignmentRecords: { where: { workDate: day }, take: 1, select: { cleaningType: true } },
      },
    }),
    prisma.room.count({ where: { hotelTenantId, isActive: true, archivedAt: null } }),
    occupiedRoomCount(hotelTenantId, workDate),
    occupiedRoomCount(hotelTenantId, lastWeek),
    movementRoomCount(hotelTenantId, workDate, "arrivalDate"),
    movementRoomCount(hotelTenantId, workDate, "departureDate"),
  ]);

  const summary = housekeepingDashboardSummary(rooms.map((room) => {
    const state = room.roomOperationalStateRecords[0];
    return {
      number: room.number,
      cleanliness: state?.cleanliness ?? null,
      noService: state?.noService ?? false,
      isExpress: Boolean(state?.isExpress) || room.housekeepingScheduleAssignmentRecords[0]?.cleaningType === "EXPRESS",
    };
  }));
  const occupancy = occupancyPercent(occupiedToday, capacity);
  const occupancyLastWeek = occupancyPercent(occupiedLastWeek, capacity);
  return {
    ...summary,
    occupancy,
    occupancyDelta: occupancy - occupancyLastWeek,
    arrivals,
    departures,
  };
}
