import type { PrismaClient } from "../../app/generated/prisma/client";
import { generateHotelBudget } from "../budget/summaries";
import { hotelLocalIso } from "../hotel/clock";
import { generateHotelRevenueWeek } from "./daily-recommendations";
import { generateForecastNarratives } from "./narratives";
import { generateHotelRevenueOverview } from "./overview";
import { getJobQueue, queues } from "../jobs/queue";

export async function generateHotelForecastTables(prisma: PrismaClient, hotelTenantId: string) {
  const hotel = await prisma.hotelTenant.findFirst({
    where: { id: hotelTenantId, isActive: true },
    select: { timeZone: true },
  });
  if (!hotel) return { ok: false as const, hotelTenantId, error: "Hotel not found" };
  const startIso = hotelLocalIso(hotel.timeZone);
  const week = await generateHotelRevenueWeek(prisma, hotelTenantId, startIso);
  const budget = await generateHotelBudget(prisma, hotelTenantId, startIso);
  const overview = await generateHotelRevenueOverview(prisma, hotelTenantId, startIso);
  const narrative = await generateForecastNarratives(prisma, hotelTenantId, startIso);
  return { ok: true as const, ...week, ...budget, overview, narrative };
}

export async function generateAllHotelForecastTables(prisma: PrismaClient, hotelTenantId?: string) {
  const hotels = await prisma.hotelTenant.findMany({
    where: { isActive: true, ...(hotelTenantId ? { id: hotelTenantId } : {}) },
    select: { id: true },
  });
  const results: Array<Record<string, unknown>> = [];
  for (const hotel of hotels) {
    try {
      results.push(await generateHotelForecastTables(prisma, hotel.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ok: false, hotelTenantId: hotel.id, error: message });
      console.error(JSON.stringify({ hotelTenantId: hotel.id, error: message }));
    }
  }
  return results;
}

export async function dispatchRevenueRefresh(hotelTenantId: string) {
  const boss = await getJobQueue();
  return boss.send(queues.revenueDaily, { hotelTenantId }, { singletonKey: `revenue:${hotelTenantId}` });
}
