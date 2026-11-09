import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../app/generated/prisma/client";
import { yearOverYear } from "../budget/summaries";
import { occupancyPercent } from "../housekeeping/dashboard-summary";
import { addDaysIso } from "../schedule/week";
import { REVENUE_WEEK_DAYS, averageAmount } from "./daily-recommendations";

export const REVENUE_OCCUPANCY_DAYS = 30;

const bookedStatuses = new Set(["reserved", "roomfixed", "departed", "occupied"]);

type NightStay = { id: string; roomNumber: string; arrival: string; departure: string };

function isoDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

function shiftYear(iso: string, years: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year + years, month - 1, day)).toISOString().slice(0, 10);
}

export function countBookedNights(stays: NightStay[], startIso: string, days: number) {
  const endIso = addDaysIso(startIso, days);
  const nights = new Set<string>();
  for (const stay of stays) {
    if (stay.departure <= startIso || stay.arrival >= endIso) continue;
    const room = stay.roomNumber.trim() || stay.id;
    for (let cursor = stay.arrival > startIso ? stay.arrival : startIso; cursor < stay.departure && cursor < endIso; cursor = addDaysIso(cursor, 1)) {
      nights.add(`${room}|${cursor}`);
    }
  }
  return nights.size;
}

function money(value: number | null) {
  return value == null ? null : Math.round(value * 100) / 100;
}

export async function generateHotelRevenueOverview(prisma: PrismaClient, hotelTenantId: string, startIso: string) {
  const start = new Date(`${startIso}T00:00:00.000Z`);
  const end = new Date(`${addDaysIso(startIso, REVENUE_OCCUPANCY_DAYS)}T00:00:00.000Z`);
  const lastStartIso = shiftYear(startIso, -1);
  const lastStart = new Date(`${lastStartIso}T00:00:00.000Z`);
  const lastEnd = new Date(`${addDaysIso(lastStartIso, REVENUE_OCCUPANCY_DAYS)}T00:00:00.000Z`);
  const weekEnd = new Date(`${addDaysIso(startIso, REVENUE_WEEK_DAYS - 1)}T00:00:00.000Z`);
  const [capacity, stays, days, months] = await Promise.all([
    prisma.room.count({ where: { hotelTenantId, isActive: true, archivedAt: null } }),
    prisma.forecastReservationRoom.findMany({
      where: {
        hotelTenantId,
        OR: [
          { arrivalDate: { lt: end }, departureDate: { gt: start } },
          { arrivalDate: { lt: lastEnd }, departureDate: { gt: lastStart } },
        ],
      },
      select: { id: true, roomNumber: true, arrivalDate: true, departureDate: true, status: true },
    }),
    prisma.revenueDailyRecommendation.findMany({
      where: { hotelTenantId, stayDate: { gte: start, lte: weekEnd } },
      select: { currentRate: true, recommendedRate: true },
    }),
    prisma.budgetMonthSummary.findMany({
      where: { hotelTenantId },
      select: { forecastRevenue: true, lastYearRevenue: true },
    }),
  ]);
  const booked = stays.filter((stay) => bookedStatuses.has(stay.status.trim().toLowerCase())).map((stay) => ({
    id: stay.id,
    roomNumber: stay.roomNumber,
    arrival: isoDay(stay.arrivalDate),
    departure: isoDay(stay.departureDate),
  }));
  const occupancy = occupancyPercent(countBookedNights(booked, startIso, REVENUE_OCCUPANCY_DAYS), capacity * REVENUE_OCCUPANCY_DAYS);
  const occupancyLast = occupancyPercent(countBookedNights(booked, lastStartIso, REVENUE_OCCUPANCY_DAYS), capacity * REVENUE_OCCUPANCY_DAYS);
  const currentRate = money(averageAmount(days.map((day) => day.currentRate == null ? null : Number(day.currentRate))));
  const recommendedRate = money(averageAmount(days.map((day) => day.recommendedRate == null ? null : Number(day.recommendedRate))));
  const seasonRevenue = Math.round(months.reduce((sum, month) => sum + Number(month.forecastRevenue), 0) * 100) / 100;
  const seasonLast = months.reduce((sum, month) => sum + Number(month.lastYearRevenue), 0);
  const seasonVsLastYear = yearOverYear(seasonRevenue, seasonLast);
  const generatedAt = new Date();
  const data = {
    occupancyPercent: occupancy,
    occupancyVsLastYear: occupancy - occupancyLast,
    currentRate,
    recommendedRate,
    seasonRevenue,
    seasonVsLastYear,
    generatedAt,
  };
  await prisma.revenueOverview.upsert({
    where: { hotelTenantId },
    create: { id: randomUUID(), hotelTenantId, ...data },
    update: data,
  });
  return data;
}

export async function listRevenueOverview(prisma: PrismaClient, hotelTenantId: string) {
  const row = await prisma.revenueOverview.findUnique({ where: { hotelTenantId } });
  if (!row) return null;
  return {
    occupancy: row.occupancyPercent,
    occupancyVsLastYear: row.occupancyVsLastYear,
    current: row.currentRate == null ? null : Number(row.currentRate),
    recommended: row.recommendedRate == null ? null : Number(row.recommendedRate),
    seasonRevenue: Number(row.seasonRevenue),
    seasonVsLastYear: row.seasonVsLastYear == null ? null : Number(row.seasonVsLastYear),
  };
}
