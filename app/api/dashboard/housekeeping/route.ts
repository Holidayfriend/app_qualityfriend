import { NextResponse } from "next/server";
import { currentAccessUser } from "../../../../lib/auth/module-access";
import { hotelLocalDate } from "../../../../lib/housekeeping/daily-plan";
import { dashboardHousekeepingSnapshot } from "../../../../lib/housekeeping/dashboard-ops";
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

  const snapshot = await dashboardHousekeepingSnapshot(current.hotel_tenant_id, workDate);
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
