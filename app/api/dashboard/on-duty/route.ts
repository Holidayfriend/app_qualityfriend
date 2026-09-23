import { NextResponse } from "next/server";
import { currentAccessUser } from "../../../../lib/auth/module-access";
import { hotelLocalDate } from "../../../../lib/housekeeping/daily-plan";
import { prisma } from "../../../../lib/prisma";
import { listOnDutyToday } from "../../../../lib/schedule/dashboard";

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

  try {
    const data = await listOnDutyToday(current.hotel_tenant_id, workDate);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ date: workDate, onDuty: 0, absent: 0, people: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
