import type { PrismaClient } from "../../app/generated/prisma/client";
import { ASA_FTP_BASE } from "../housekeeping/asa-file";
import { hotelLocalDate } from "../housekeeping/daily-plan";

export const RATES_FILE = "rates.json";
// "TAG_HP" is the normal 1-night price; TAG6_HP / TAG7_HP are the longer-stay prices.
export const RATE_PLAN = "TAG_HP";
export const RATE_DAYS = 14;
const MAX_BYTES = 5 * 1024 * 1024;

export type RawRate = {
  plan: string;
  code: string;
  from: string;
  to: string;
  occ1: number | null;
  occ2: number | null;
};

export type DayRate = {
  code: string;
  date: string;
  pricePerPerson1: number | null;
  pricePerPerson2: number | null;
  roomPrice2Adults: number | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function price(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function parseRates(payload: unknown): RawRate[] {
  const list = payload && typeof payload === "object" ? (payload as { rates?: unknown }).rates : null;
  if (!Array.isArray(list)) throw new RatesFileError("RATES_FILE_INVALID", "no rates list");
  return list.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const plan = typeof row.rate_plan === "string" ? row.rate_plan.trim() : "";
    const code = typeof row.room_category === "string" ? row.room_category.trim() : "";
    const from = typeof row.date_from === "string" ? row.date_from : "";
    const to = typeof row.date_to_incl === "string" ? row.date_to_incl : "";
    if (!plan || !code || !ISO_DATE.test(from) || !ISO_DATE.test(to)) return [];
    return [{ plan, code, from, to, occ1: price(row.price_occ1), occ2: price(row.price_occ2) }];
  });
}

export function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

// One price per day and room category for the next `days` days (dates with no price in the file are skipped).
export function ratesForDays(rates: RawRate[], start: string, days = RATE_DAYS, plan = RATE_PLAN): DayRate[] {
  const result: DayRate[] = [];
  const wanted = rates.filter((rate) => rate.plan === plan);
  const codes = [...new Set(wanted.map((rate) => rate.code))];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addDays(start, offset);
    for (const code of codes) {
      const row = wanted.find((rate) => rate.code === code && rate.from <= date && date <= rate.to);
      if (!row) continue;
      result.push({
        code,
        date,
        pricePerPerson1: row.occ1,
        pricePerPerson2: row.occ2,
        // occ2 is "per person with 2 persons", so a room for 2 adults costs twice that.
        roomPrice2Adults: row.occ2 === null ? null : round2(row.occ2 * 2),
      });
    }
  }
  return result;
}

type CategoryNames = { id: string; names: Array<string | null | undefined> };

// Match a code from the file (EZ, MERL, JOHAN...) to the hotel's room category by its name:
// JOHAN -> Deluxe DZ "JOHANNIS", EZ -> Einzelzimmer. A code that matches none or several is left out.
export function matchCategories(codes: string[], categories: CategoryNames[]) {
  const matched = new Map<string, string>();
  const unmatched: string[] = [];
  for (const code of codes) {
    const key = code.toUpperCase();
    const hits = categories.filter((category) => category.names.some((name) => {
      const text = (name ?? "").trim().toUpperCase();
      if (!text) return false;
      if (key === "EZ") return text.startsWith("EINZELZIMMER") || /(^|[^A-Z])EZ([^A-Z]|$)/.test(text);
      return text.includes(key);
    }));
    if (hits.length === 1) matched.set(code, hits[0].id);
    else unmatched.push(code);
  }
  return { matched, unmatched };
}

export class RatesFileError extends Error {
  constructor(readonly code: "RATES_FILE_NOT_FOUND" | "RATES_FILE_UNREACHABLE" | "RATES_FILE_INVALID", readonly detail = "") {
    super(code);
  }
}

export async function readRatesFile(base = ASA_FTP_BASE) {
  const url = new URL(RATES_FILE, base.endsWith("/") ? base : `${base}/`);
  let response: Response;
  try {
    response = await fetch(url, { redirect: "follow", cache: "no-store", headers: { Accept: "application/json", "User-Agent": "QualityFriend/1.0" }, signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    const cause = error instanceof Error ? (error.cause as { code?: string; message?: string } | undefined) : undefined;
    throw new RatesFileError("RATES_FILE_UNREACHABLE", [error instanceof Error ? error.message : "", cause?.code ?? cause?.message ?? ""].filter(Boolean).join(" / "));
  }
  if (response.status === 404) throw new RatesFileError("RATES_FILE_NOT_FOUND", "HTTP 404");
  if (!response.ok) throw new RatesFileError("RATES_FILE_UNREACHABLE", `HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new RatesFileError("RATES_FILE_INVALID", "file too large");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RatesFileError("RATES_FILE_INVALID", "not valid JSON");
  }
}

export async function importOwnRates(
  prisma: PrismaClient,
  hotelTenantId: string,
  options: { read?: () => Promise<unknown>; now?: Date } = {},
) {
  const hotel = await prisma.hotelTenant.findFirst({ where: { id: hotelTenantId, isActive: true }, select: { timeZone: true } });
  if (!hotel) throw new Error("NOT_FOUND");

  const rates = parseRates(await (options.read ?? readRatesFile)());
  const start = hotelLocalDate(hotel.timeZone?.trim() || "Europe/Rome", options.now ?? new Date());
  const days = ratesForDays(rates, start);

  const categories = await prisma.roomCategory.findMany({
    where: { hotelTenantId, isActive: true },
    select: { id: true, nameEn: true, nameDe: true, nameIt: true },
  });
  const codes = [...new Set(rates.filter((rate) => rate.plan === RATE_PLAN).map((rate) => rate.code))];
  const { matched, unmatched } = matchCategories(codes, categories.map((category) => ({ id: category.id, names: [category.nameEn, category.nameDe, category.nameIt] })));

  const fetchedAt = options.now ?? new Date();
  const data = days.flatMap((day) => {
    const categoryId = matched.get(day.code);
    if (!categoryId) return [];
    return [{
      hotelTenantId,
      categoryId,
      rateDate: new Date(`${day.date}T00:00:00Z`),
      ratePlan: RATE_PLAN,
      pricePerPerson1: day.pricePerPerson1,
      pricePerPerson2: day.pricePerPerson2,
      roomPrice2Adults: day.roomPrice2Adults,
      fetchedAt,
    }];
  });

  // Replace the whole window so changed or removed prices never linger.
  await prisma.$transaction(async (tx) => {
    await tx.ownRoomRate.deleteMany({ where: { hotelTenantId, rateDate: { gte: new Date(`${start}T00:00:00Z`) } } });
    if (data.length) await tx.ownRoomRate.createMany({ data });
  });

  return { imported: data.length, categories: matched.size, unmatched, startDate: start, endDate: addDays(start, RATE_DAYS - 1), fetchedAt: fetchedAt.toISOString() };
}
