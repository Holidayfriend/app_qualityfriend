import { NextResponse } from "next/server";
import { currentAccessUser } from "../../../../lib/auth/module-access";
import { hotelLocalDate } from "../../../../lib/housekeeping/daily-plan";
import { housekeepingDashboardSummary } from "../../../../lib/housekeeping/dashboard-summary";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const current = await currentAccessUser();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const hotel = await prisma.hotelTenant.findUnique({
    where: { id: current.hotel_tenant_id },
    select: { timeZone: true },
  });
  if (!hotel) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  let workDate: string;
  try {
    workDate = hotelLocalDate(hotel.timeZone?.trim() || "UTC");
  } catch {
    return NextResponse.json({ error: "INVALID_HOTEL_TIME_ZONE" }, { status: 500 });
  }
  const day = new Date(`${workDate}T00:00:00.000Z`);

  const rooms = await prisma.room.findMany({
    where: {
      hotelTenantId: current.hotel_tenant_id,
      isActive: true,
      archivedAt: null,
      reservationRoomStayRecords: {
        some: {
          arrivalDate: { lte: day },
          departureDate: { gte: day },
          reservation: { sourcePresent: true, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
        },
      },
    },
    select: {
      number: true,
      roomOperationalStateRecords: { take: 1, select: { cleanliness: true, noService: true, isExpress: true } },
      housekeepingScheduleAssignmentRecords: { where: { workDate: day }, take: 1, select: { cleaningType: true } },
    },
  });

  const summary = housekeepingDashboardSummary(rooms.map((room) => {
    const state = room.roomOperationalStateRecords[0];
    return {
      number: room.number,
      cleanliness: state?.cleanliness ?? null,
      noService: state?.noService ?? false,
      isExpress: Boolean(state?.isExpress) || room.housekeepingScheduleAssignmentRecords[0]?.cleaningType === "EXPRESS",
    };
  }));

  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
