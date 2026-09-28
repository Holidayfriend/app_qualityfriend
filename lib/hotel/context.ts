import "server-only";

import { prisma } from "../prisma";
import { hotelTimeZone } from "./clock";

export async function hotelTimeZoneFor(hotelTenantId: string) {
  const hotel = await prisma.hotelTenant.findUnique({
    where: { id: hotelTenantId },
    select: { timeZone: true },
  });
  return hotelTimeZone(hotel?.timeZone);
}
