import { NextResponse } from "next/server";
import { currentAccessUser } from "../../../../lib/auth/module-access";
import { hotelTimeZone } from "../../../../lib/hotel/clock";
import { hotelLocalDate } from "../../../../lib/housekeeping/daily-plan";
import { dashboardHousekeepingSnapshot } from "../../../../lib/housekeeping/dashboard-ops";
import { prisma } from "../../../../lib/prisma";
import { OWN_HOTEL_PREFIX } from "../../../../lib/revenue/daily-recommendations";

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
    workDate = hotelLocalDate(hotelTimeZone(hotel.timeZone));
  } catch {
    return NextResponse.json({ error: "INVALID_HOTEL_TIME_ZONE" }, { status: 500 });
  }

  const snapshot = await dashboardHousekeepingSnapshot(current.hotel_tenant_id, workDate);
  const settings = await prisma.competitorSettings.findUnique({
    where: { hotelTenantId: current.hotel_tenant_id },
    select: { locationCode: true },
  });
  const own = settings?.locationCode
    ? await prisma.competitor.findFirst({
      where: {
        hotelTenantId: current.hotel_tenant_id,
        locationKey: String(settings.locationCode),
        name: { startsWith: OWN_HOTEL_PREFIX },
      },
      orderBy: { lastFetchedAt: "desc" },
      select: { rating: true, reviewCount: true },
    })
    : null;
  return NextResponse.json(
    { ...snapshot, rating: own?.rating ?? null, reviewCount: own?.reviewCount ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
