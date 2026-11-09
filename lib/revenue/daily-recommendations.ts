import { randomUUID } from "node:crypto";
import type { PrismaClient, ReservationStatus } from "../../app/generated/prisma/client";
import { completeHotelChatJson } from "../ai/complete";
import { hotelLocalIso } from "../hotel/clock";
import { occupancyPercent } from "../housekeeping/dashboard-summary";
import { addDaysIso } from "../schedule/week";

export const REVENUE_WEEK_DAYS = 7;
export const OWN_HOTEL_PREFIX = "[OWN HOTEL] ";

const closedReservationStatuses: ReservationStatus[] = ["CANCELLED", "NO_SHOW"];

export type RevenueStatus = "URGENT" | "ADJUST" | "OPTIMAL";

export type RevenueDayInput = {
  date: string;
  occupancy: number;
  current: number | null;
  competitorAvg: number | null;
};

export function weekDates(startIso: string, days = REVENUE_WEEK_DAYS) {
  return Array.from({ length: days }, (_, index) => addDaysIso(startIso, index));
}

export function averageAmount(values: Array<number | null | undefined>) {
  const amounts = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (!amounts.length) return null;
  return Math.round((amounts.reduce((sum, value) => sum + value, 0) / amounts.length) * 100) / 100;
}

export function splitHotelRates(rows: Array<{ name: string; adr: number | null }>) {
  const own = rows.filter((row) => row.name.startsWith(OWN_HOTEL_PREFIX));
  const competitors = rows.filter((row) => !row.name.startsWith(OWN_HOTEL_PREFIX));
  return {
    current: averageAmount(own.map((row) => row.adr)),
    competitorAvg: averageAmount(competitors.map((row) => row.adr)),
  };
}

export function recommendationStatus(current: number | null, recommended: number | null): RevenueStatus {
  if (current == null || recommended == null || current <= 0) return "ADJUST";
  const delta = (recommended - current) / current;
  if (Math.abs(delta) < 0.02) return "OPTIMAL";
  if (delta >= 0.08) return "URGENT";
  return "ADJUST";
}

export function fallbackRate(occupancy: number, current: number | null, competitorAvg: number | null) {
  if (current == null && competitorAvg == null) return null;
  if (current == null) return Math.round(competitorAvg as number);
  let rate = current;
  if (occupancy >= 85) rate = current * 1.08;
  else if (occupancy >= 70) rate = current * 1.03;
  else if (occupancy <= 45) rate = current * 0.97;
  if (competitorAvg != null && occupancy >= 80 && competitorAvg > rate) rate = (rate + competitorAvg) / 2;
  if (competitorAvg != null && occupancy <= 50 && competitorAvg < rate) rate = (rate + competitorAvg) / 2;
  return Math.max(1, Math.round(rate));
}

function utcDay(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function amount(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number | null) {
  return value == null ? null : Math.round(value * 100) / 100;
}

function rateForDate(parsed: Record<string, unknown> | null, date: string) {
  const rates = parsed && Array.isArray(parsed.rates) ? parsed.rates : [];
  const match = rates.find((item) => item && typeof item === "object" && (item as { date?: unknown }).date === date) as { rate?: unknown } | undefined;
  const rate = typeof match?.rate === "number" ? match.rate : Number(match?.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(rate * 100) / 100;
}

async function occupiedByDate(prisma: PrismaClient, hotelTenantId: string, dates: string[]) {
  const start = utcDay(dates[0]);
  const end = utcDay(dates[dates.length - 1]);
  const stays = await prisma.reservationRoomStay.findMany({
    where: {
      hotelTenantId,
      arrivalDate: { lte: end },
      departureDate: { gt: start },
      reservation: { sourcePresent: true, status: { notIn: closedReservationStatuses } },
      room: { isActive: true, archivedAt: null },
    },
    select: { roomId: true, arrivalDate: true, departureDate: true },
  });
  return new Map(dates.map((date) => {
    const day = utcDay(date).getTime();
    const rooms = new Set<string>();
    for (const stay of stays) {
      if (stay.arrivalDate.getTime() <= day && stay.departureDate.getTime() > day) rooms.add(stay.roomId);
    }
    return [date, rooms.size] as const;
  }));
}

export async function loadHotelAdr(prisma: PrismaClient, hotelTenantId: string) {
  const settings = await prisma.competitorSettings.findUnique({
    where: { hotelTenantId },
    select: { locationCode: true },
  });
  if (!settings?.locationCode) return { current: null, competitorAvg: null };
  const rows = await prisma.competitor.findMany({
    where: { hotelTenantId, locationKey: String(settings.locationCode) },
    select: { name: true, adr: true },
  });
  return splitHotelRates(rows.map((row) => ({ name: row.name, adr: amount(row.adr) })));
}

async function recommendRates(prisma: PrismaClient, hotelTenantId: string, days: RevenueDayInput[]) {
  const priced = days.some((day) => day.current != null || day.competitorAvg != null);
  if (!priced) return { rates: new Map<string, number | null>(), ai: false };
  let parsed: Record<string, unknown> | null = null;
  let ai = false;
  try {
    parsed = await completeHotelChatJson(prisma, hotelTenantId, [
      {
        role: "system",
        content: "You recommend one nightly room rate in EUR for each stay date. Use only the facts given. Do not add events, weather, last year, or any number that is not in the facts. Current is this hotel's ADR and competitorAvg is the average competitor ADR. Both prices are one snapshot, repeated for every date. Occupancy is the percent of rooms already booked that night. Raise the rate when occupancy is high and current is at or below the competitor average. Lower it slightly when occupancy is low and current is above the competitor average. Keep it close when occupancy is moderate. Return JSON only: {\"rates\":[{\"date\":\"YYYY-MM-DD\",\"rate\":380}]}. Include every date once. rate is a positive number.",
      },
      { role: "user", content: JSON.stringify({ days }) },
    ], { temperature: 0.2, timeoutMs: 60_000 });
    ai = parsed != null;
  } catch (error) {
    console.error(JSON.stringify({ hotelTenantId, error: error instanceof Error ? error.message : String(error) }));
  }
  return {
    ai,
    rates: new Map(days.map((day) => [day.date, rateForDate(parsed, day.date) ?? fallbackRate(day.occupancy, day.current, day.competitorAvg)])),
  };
}

export async function generateHotelRevenueWeek(prisma: PrismaClient, hotelTenantId: string, startIso: string) {
  const dates = weekDates(startIso);
  const [capacity, occupied, rates] = await Promise.all([
    prisma.room.count({ where: { hotelTenantId, isActive: true, archivedAt: null } }),
    occupiedByDate(prisma, hotelTenantId, dates),
    loadHotelAdr(prisma, hotelTenantId),
  ]);
  const days: RevenueDayInput[] = dates.map((date) => ({
    date,
    occupancy: occupancyPercent(occupied.get(date) ?? 0, capacity),
    current: rates.current,
    competitorAvg: rates.competitorAvg,
  }));
  const recommended = await recommendRates(prisma, hotelTenantId, days);
  const generatedAt = new Date();
  await prisma.$transaction(days.map((day) => {
    const recommendedRate = money(recommended.rates.get(day.date) ?? null);
    const data = {
      occupancyPercent: day.occupancy,
      currentRate: money(day.current),
      recommendedRate,
      competitorAvg: money(day.competitorAvg),
      status: recommendationStatus(day.current, recommendedRate),
      generatedAt,
    };
    return prisma.revenueDailyRecommendation.upsert({
      where: { hotelTenantId_stayDate: { hotelTenantId, stayDate: utcDay(day.date) } },
      create: { id: randomUUID(), hotelTenantId, stayDate: utcDay(day.date), adopted: false, ...data },
      update: data,
    });
  }));
  return { hotelTenantId, startIso, days: days.length, ai: recommended.ai };
}

export async function generateAllHotelRevenueWeeks(prisma: PrismaClient, hotelTenantId?: string) {
  const hotels = await prisma.hotelTenant.findMany({
    where: { isActive: true, ...(hotelTenantId ? { id: hotelTenantId } : {}) },
    select: { id: true, timeZone: true },
  });
  const results: Array<Record<string, unknown>> = [];
  for (const hotel of hotels) {
    try {
      results.push({ ok: true, ...await generateHotelRevenueWeek(prisma, hotel.id, hotelLocalIso(hotel.timeZone)) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ ok: false, hotelTenantId: hotel.id, error: message });
      console.error(JSON.stringify({ hotelTenantId: hotel.id, error: message }));
    }
  }
  return results;
}

export function publicRevenueStatus(status: RevenueStatus) {
  if (status === "URGENT") return "urgent";
  if (status === "OPTIMAL") return "optimal";
  return "adjust";
}

export async function listCurrentRevenueWeek(prisma: PrismaClient, hotelTenantId: string) {
  const hotel = await prisma.hotelTenant.findFirst({
    where: { id: hotelTenantId },
    select: { timeZone: true },
  });
  const dates = weekDates(hotelLocalIso(hotel?.timeZone));
  const rows = await prisma.revenueDailyRecommendation.findMany({
    where: {
      hotelTenantId,
      stayDate: { gte: utcDay(dates[0]), lte: utcDay(dates[dates.length - 1]) },
    },
    orderBy: { stayDate: "asc" },
  });
  return {
    generatedAt: rows.reduce<string | null>((latest, row) => {
      const value = row.generatedAt.toISOString();
      return !latest || value > latest ? value : latest;
    }, null),
    rows: rows.map((row) => ({
      date: isoDate(row.stayDate),
      occupancy: row.occupancyPercent,
      current: amount(row.currentRate),
      recommended: amount(row.recommendedRate),
      competitorAvg: amount(row.competitorAvg),
      status: publicRevenueStatus(row.status),
      adopted: row.adopted,
    })),
  };
}

export async function setRevenueRecommendationAdopted(prisma: PrismaClient, hotelTenantId: string, date: string, adopted: boolean) {
  const result = await prisma.revenueDailyRecommendation.updateMany({
    where: { hotelTenantId, stayDate: utcDay(date) },
    data: { adopted },
  });
  return result.count > 0;
}
