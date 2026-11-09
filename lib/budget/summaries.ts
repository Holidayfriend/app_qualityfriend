import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../app/generated/prisma/client";
import { completeHotelChatJson } from "../ai/complete";
import { occupancyPercent } from "../housekeeping/dashboard-summary";
import { fallbackRate, loadHotelAdr } from "../revenue/daily-recommendations";

const bookedStatuses = new Set(["reserved", "roomfixed", "departed", "occupied"]);

export type BudgetStay = {
  roomNumber: string;
  categoryId: string | null;
  arrival: string;
  departure: string;
  accommodation: number;
  additional: number;
  spa: number;
};

type Bucket = { roomNights: Set<string>; nights: number; accommodation: number; revenue: number };

export function seasonMonths(todayIso: string) {
  const year = Number(todayIso.slice(0, 4));
  const month = Number(todayIso.slice(5, 7));
  const months: Array<{ year: number; month: number }> = [];
  for (let current = month; current <= 12; current += 1) months.push({ year, month: current });
  return months;
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function yearOverYear(current: number, previous: number) {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function revenueShares(amounts: number[]) {
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  if (total <= 0) return amounts.map(() => 0);
  const exact = amounts.map((amount) => (amount / total) * 100);
  const floors = exact.map((amount) => Math.floor(amount));
  let left = 100 - floors.reduce((sum, amount) => sum + amount, 0);
  const order = exact.map((amount, index) => ({ index, fraction: amount - floors[index] })).sort((leftItem, rightItem) => rightItem.fraction - leftItem.fraction);
  for (const item of order) {
    if (left <= 0) break;
    floors[item.index] += 1;
    left -= 1;
  }
  return floors;
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function stayNights(arrival: string, departure: string) {
  const nights: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrival) || !/^\d{4}-\d{2}-\d{2}$/.test(departure) || departure <= arrival) return nights;
  for (let cursor = arrival; cursor < departure && nights.length < 500; cursor = addDays(cursor, 1)) nights.push(cursor);
  return nights;
}

function splitMoney(total: number, parts: number) {
  const cents = Math.round(total * 100);
  const base = Math.trunc(cents / parts);
  let remainder = cents - base * parts;
  return Array.from({ length: parts }, () => {
    const adjust = remainder > 0 ? 1 : remainder < 0 ? -1 : 0;
    remainder -= adjust;
    return (base + adjust) / 100;
  });
}

function bucket(): Bucket {
  return { roomNights: new Set<string>(), nights: 0, accommodation: 0, revenue: 0 };
}

export function summarizeStays(stays: BudgetStay[]) {
  const months = new Map<string, Bucket>();
  const categories = new Map<string, Bucket>();
  stays.forEach((stay, index) => {
    const nights = stayNights(stay.arrival, stay.departure);
    if (!nights.length) return;
    const roomKey = stay.roomNumber.trim() || `stay-${index}`;
    const accommodation = splitMoney(stay.accommodation, nights.length);
    const additional = splitMoney(stay.additional, nights.length);
    const spa = splitMoney(stay.spa, nights.length);
    nights.forEach((night, nightIndex) => {
      const monthKey = night.slice(0, 7);
      const month = months.get(monthKey) ?? bucket();
      month.roomNights.add(`${roomKey}|${night}`);
      month.nights += 1;
      month.accommodation += accommodation[nightIndex];
      month.revenue += accommodation[nightIndex] + additional[nightIndex] + spa[nightIndex];
      months.set(monthKey, month);
      if (!stay.categoryId) return;
      const key = `${monthKey}|${stay.categoryId}`;
      const category = categories.get(key) ?? bucket();
      category.roomNights.add(`${roomKey}|${night}`);
      category.nights += 1;
      category.accommodation += accommodation[nightIndex];
      category.revenue += accommodation[nightIndex] + additional[nightIndex] + spa[nightIndex];
      categories.set(key, category);
    });
  });
  return { months, categories };
}

function money(value: number | null) {
  return value == null ? null : Math.round(value * 100) / 100;
}

function isoDay(value: Date) {
  return value.toISOString().slice(0, 10);
}

function rateForKey(parsed: Record<string, unknown> | null, key: string) {
  const rates = parsed && Array.isArray(parsed.rates) ? parsed.rates : [];
  const match = rates.find((item) => item && typeof item === "object" && (item as { key?: unknown }).key === key) as { rate?: unknown } | undefined;
  const rate = typeof match?.rate === "number" ? match.rate : Number(match?.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(rate * 100) / 100;
}

async function recommendBudgetRates(prisma: PrismaClient, hotelTenantId: string, rows: Array<{ key: string; occupancy: number; current: number | null; competitorAvg: number | null }>) {
  const priced = rows.some((row) => row.current != null || row.competitorAvg != null);
  if (!priced) return new Map(rows.map((row) => [row.key, null]));
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = await completeHotelChatJson(prisma, hotelTenantId, [
      {
        role: "system",
        content: "You recommend one average nightly room rate in EUR for each key. Use only the facts given. Current is this hotel's ADR and competitorAvg is the average competitor ADR. Occupancy is the percent of rooms already booked. Raise the rate when occupancy is high and current is at or below the competitor average. Lower it slightly when occupancy is low and current is above the competitor average. Keep it close when occupancy is moderate. Return JSON only: {\"rates\":[{\"key\":\"2026-11\",\"rate\":380}]}. Include every key once. rate is a positive number.",
      },
      { role: "user", content: JSON.stringify({ rows }) },
    ], { temperature: 0.2, timeoutMs: 60_000 });
  } catch (error) {
    console.error(JSON.stringify({ hotelTenantId, error: error instanceof Error ? error.message : String(error) }));
  }
  return new Map(rows.map((row) => [row.key, rateForKey(parsed, row.key) ?? fallbackRate(row.occupancy, row.current, row.competitorAvg)]));
}

export async function generateHotelBudget(prisma: PrismaClient, hotelTenantId: string, todayIso: string) {
  const season = seasonMonths(todayIso);
  const year = season[0]?.year ?? Number(todayIso.slice(0, 4));
  const current = season[0] ?? { year, month: Number(todayIso.slice(5, 7)) };
  const rangeStart = new Date(Date.UTC(year - 1, 0, 1));
  const rangeEnd = new Date(Date.UTC(year + 1, 0, 1));
  const [rooms, stays, rates] = await Promise.all([
    prisma.room.findMany({
      where: { hotelTenantId, isActive: true, archivedAt: null },
      select: { number: true, categoryId: true, category: { select: { id: true, nameEn: true, nameDe: true, nameIt: true, currentAdr: true, isActive: true, archivedAt: true } } },
    }),
    prisma.forecastReservationRoom.findMany({
      where: { hotelTenantId, arrivalDate: { lt: rangeEnd }, departureDate: { gt: rangeStart } },
      select: { roomNumber: true, arrivalDate: true, departureDate: true, status: true, accommodationSale: true, additionalServicesSale: true, spaSale: true },
    }),
    loadHotelAdr(prisma, hotelTenantId),
  ]);
  const categoryByRoom = new Map(rooms.filter((room) => room.category?.isActive && room.category.archivedAt == null).map((room) => [room.number, room.categoryId]));
  const facts = summarizeStays(stays.filter((stay) => bookedStatuses.has(stay.status.trim().toLowerCase())).map((stay) => ({
    roomNumber: stay.roomNumber,
    categoryId: categoryByRoom.get(stay.roomNumber) ?? null,
    arrival: isoDay(stay.arrivalDate),
    departure: isoDay(stay.departureDate),
    accommodation: Number(stay.accommodationSale),
    additional: Number(stay.additionalServicesSale),
    spa: Number(stay.spaSale),
  })));
  const capacity = rooms.length;
  const monthFacts = season.map((item) => {
    const key = `${item.year}-${String(item.month).padStart(2, "0")}`;
    const bucket = facts.months.get(key);
    const currentAdr = bucket && bucket.nights > 0 ? money(bucket.accommodation / bucket.nights) : null;
    return {
      ...item,
      key,
      occupancy: Math.min(100, occupancyPercent(bucket?.roomNights.size ?? 0, capacity * daysInMonth(item.year, item.month))),
      currentAdr,
      revenue: money(bucket?.revenue ?? 0) ?? 0,
      lastYearRevenue: money(facts.months.get(`${item.year - 1}-${String(item.month).padStart(2, "0")}`)?.revenue ?? 0) ?? 0,
    };
  });
  const categories = [...new Map(rooms.flatMap((room) => room.category && room.category.isActive && room.category.archivedAt == null ? [[room.category.id, room.category]] : [])).values()];
  const currentKey = `${current.year}-${String(current.month).padStart(2, "0")}`;
  const categoryFacts = categories.map((category) => {
    const bucket = facts.categories.get(`${currentKey}|${category.id}`);
    const roomCount = rooms.filter((room) => room.categoryId === category.id).length;
    const calculated = bucket && bucket.nights > 0 ? money(bucket.accommodation / bucket.nights) : null;
    return {
      category,
      roomCount,
      occupancy: Math.min(100, occupancyPercent(bucket?.roomNights.size ?? 0, roomCount * daysInMonth(current.year, current.month))),
      currentAdr: money(category.currentAdr == null ? calculated : Number(category.currentAdr)),
      revenue: money(bucket?.revenue ?? 0) ?? 0,
    };
  }).sort((left, right) => left.category.nameEn.localeCompare(right.category.nameEn));
  const shares = revenueShares(categoryFacts.map((item) => item.revenue));
  const recommended = await recommendBudgetRates(prisma, hotelTenantId, [
    ...monthFacts.map((item) => ({ key: item.key, occupancy: item.occupancy, current: item.currentAdr, competitorAvg: rates.competitorAvg })),
    ...categoryFacts.map((item) => ({ key: `category:${item.category.id}`, occupancy: item.occupancy, current: item.currentAdr, competitorAvg: rates.competitorAvg })),
  ]);
  const generatedAt = new Date();
  const monthRows: Prisma.BudgetMonthSummaryCreateManyInput[] = monthFacts.map((item) => ({
    id: randomUUID(),
    hotelTenantId,
    year: item.year,
    month: item.month,
    occupancyPercent: item.occupancy,
    currentAdr: item.currentAdr,
    recommendedAdr: money(recommended.get(item.key) ?? null),
    forecastRevenue: item.revenue,
    lastYearRevenue: item.lastYearRevenue,
    vsLastYearPercent: yearOverYear(item.revenue, item.lastYearRevenue),
    generatedAt,
  }));
  const categoryRows: Prisma.BudgetCategorySummaryCreateManyInput[] = categoryFacts.map((item, index) => ({
    id: randomUUID(),
    hotelTenantId,
    year: current.year,
    month: current.month,
    categoryId: item.category.id,
    nameEn: item.category.nameEn,
    nameDe: item.category.nameDe,
    nameIt: item.category.nameIt,
    roomCount: item.roomCount,
    occupancyPercent: item.occupancy,
    currentAdr: item.currentAdr,
    recommendedAdr: money(recommended.get(`category:${item.category.id}`) ?? null),
    revenue: item.revenue,
    revenueShare: shares[index] ?? 0,
    generatedAt,
  }));
  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.budgetMonthSummary.deleteMany({ where: { hotelTenantId } }),
    prisma.budgetCategorySummary.deleteMany({ where: { hotelTenantId } }),
  ];
  if (monthRows.length) writes.push(prisma.budgetMonthSummary.createMany({ data: monthRows }));
  if (categoryRows.length) writes.push(prisma.budgetCategorySummary.createMany({ data: categoryRows }));
  await prisma.$transaction(writes);
  return { months: monthRows.length, categories: categoryRows.length };
}

function amount(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function listHotelBudget(prisma: PrismaClient, hotelTenantId: string) {
  const [months, categories] = await Promise.all([
    prisma.budgetMonthSummary.findMany({ where: { hotelTenantId }, orderBy: [{ year: "asc" }, { month: "asc" }] }),
    prisma.budgetCategorySummary.findMany({ where: { hotelTenantId }, orderBy: { nameEn: "asc" } }),
  ]);
  const generatedAt = [...months, ...categories].reduce<string | null>((latest, row) => {
    const value = row.generatedAt.toISOString();
    return latest == null || value > latest ? value : latest;
  }, null);
  return {
    generatedAt,
    year: months[0]?.year ?? categories[0]?.year ?? null,
    currentMonth: categories[0]?.month ?? months[0]?.month ?? null,
    months: months.map((row) => ({
      year: row.year,
      month: row.month,
      occupancy: row.occupancyPercent,
      current: amount(row.currentAdr),
      recommended: amount(row.recommendedAdr),
      revenue: amount(row.forecastRevenue) ?? 0,
      lastYearRevenue: amount(row.lastYearRevenue) ?? 0,
      vsLastYear: amount(row.vsLastYearPercent),
    })),
    categories: categories.map((row) => ({
      id: row.categoryId,
      nameEn: row.nameEn,
      nameDe: row.nameDe,
      nameIt: row.nameIt,
      rooms: row.roomCount,
      occupancy: row.occupancyPercent,
      current: amount(row.currentAdr),
      recommended: amount(row.recommendedAdr),
      share: row.revenueShare,
    })),
  };
}
