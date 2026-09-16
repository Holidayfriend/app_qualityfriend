import { NextResponse } from "next/server";
import { currentAccessUser } from "../../../../lib/auth/module-access";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  const current = await currentAccessUser();
  if (!current) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const weather = await prisma.hotelWeather.findUnique({
    where: { hotelTenantId: current.hotel_tenant_id },
    select: {
      cityName: true,
      temperatureC: true,
      conditionKey: true,
      icon: true,
      rainFromHour: true,
      windKmh: true,
      uvIndex: true,
      fetchedAt: true,
    },
  });

  return NextResponse.json({ weather });
}
