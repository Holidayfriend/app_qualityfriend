import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../app/generated/prisma/client";
import { completeHotelChatJson } from "../ai/complete";
import { OWN_HOTEL_PREFIX, weekDates } from "./daily-recommendations";

export type NarrativeText = { en: string; de: string; it: string };

const emptyText: NarrativeText = { en: "", de: "", it: "" };

function paragraph(value: unknown) {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text.length >= 20 && text.length <= 1200 ? text : "";
}

function languageSource(parsed: Record<string, unknown> | null) {
  if (!parsed) return null;
  for (const key of ["summary", "texts", "narrative", "result"]) {
    const nested = parsed[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) return nested as Record<string, unknown>;
  }
  return parsed;
}

function languageText(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) return "";
  for (const key of keys) {
    const text = paragraph(source[key]);
    if (text) return text;
  }
  return "";
}

function sameText(left: string, right: string) {
  return left.length > 0 && left.toLowerCase() === right.toLowerCase();
}

function looksLikeDump(text: string) {
  return text.split(";").length - 1 >= 2 || text.split(",").length - 1 > 5 || text.length > 600 || /^date\s+\d{4}/i.test(text);
}

export function narrativeFromAi(parsed: Record<string, unknown> | null, fallback: NarrativeText): NarrativeText {
  const source = languageSource(parsed);
  let en = languageText(source, ["en", "english", "EN"]);
  let de = languageText(source, ["de", "german", "DE"]);
  let it = languageText(source, ["it", "italian", "IT"]);
  if (looksLikeDump(en)) en = "";
  if (looksLikeDump(de)) de = "";
  if (looksLikeDump(it)) it = "";
  if (sameText(de, en)) de = "";
  if (sameText(it, en) || sameText(it, de)) it = "";
  return {
    en: en || fallback.en,
    de: de || fallback.de,
    it: it || fallback.it,
  };
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function money(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function average(values: Array<number | null>) {
  const amounts = values.filter((value): value is number => value != null);
  if (!amounts.length) return null;
  return Math.round(amounts.reduce((sum, value) => sum + value, 0) / amounts.length);
}

function priceFallback(days: number, occupancy: number | null, current: number | null, recommended: number | null): NarrativeText {
  const occ = occupancy == null ? "–" : `${occupancy}%`;
  const currentText = current == null ? "–" : `${current}€`;
  const recommendedText = recommended == null ? "–" : `${recommended}€`;
  return {
    en: `Across the next ${days} days, average occupancy is ${occ}. The current ADR is ${currentText} and the recommended ADR averages ${recommendedText}.`,
    de: `In den nächsten ${days} Tagen liegt die durchschnittliche Auslastung bei ${occ}. Der aktuelle ADR ist ${currentText}, der empfohlene ADR im Schnitt ${recommendedText}.`,
    it: `Nei prossimi ${days} giorni l'occupazione media è ${occ}. L'ADR attuale è ${currentText} e l'ADR consigliato medio è ${recommendedText}.`,
  };
}

function competitorFallback(own: number | null, competitorAvg: number | null, count: number): NarrativeText {
  const ownText = own == null ? "–" : `${own}€`;
  const avgText = competitorAvg == null ? "–" : `${competitorAvg}€`;
  return {
    en: `Your ADR is ${ownText}. The average ADR of ${count} competitors is ${avgText}.`,
    de: `Ihr ADR ist ${ownText}. Der durchschnittliche ADR von ${count} Mitbewerbern ist ${avgText}.`,
    it: `Il vostro ADR è ${ownText}. L'ADR medio di ${count} concorrenti è ${avgText}.`,
  };
}

async function ask(prisma: PrismaClient, hotelTenantId: string, facts: unknown, fallback: NarrativeText) {
  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = await completeHotelChatJson(prisma, hotelTenantId, [
      {
        role: "system",
        content: "Write one short hotel-manager summary in English, German, and Italian. Use only the numbers and names in the facts. Write normal sentences. Do not repeat field names, do not list every date, and do not add events, weather, rankings, or any figure that is not in the facts. German and Italian must be real translations, never a copy of the English. Return JSON only: {\"en\":\"...\",\"de\":\"...\",\"it\":\"...\"}. Each value is one or two sentences, at most 500 characters.",
      },
      { role: "user", content: JSON.stringify(facts) },
    ], { temperature: 0.2, timeoutMs: 60_000 });
  } catch (error) {
    console.error(JSON.stringify({ hotelTenantId, error: error instanceof Error ? error.message : String(error) }));
  }
  return narrativeFromAi(parsed, fallback);
}

export async function generateForecastNarratives(prisma: PrismaClient, hotelTenantId: string, startIso: string) {
  const dates = weekDates(startIso);
  const [rows, settings] = await Promise.all([
    prisma.revenueDailyRecommendation.findMany({
      where: { hotelTenantId, stayDate: { gte: new Date(`${dates[0]}T00:00:00.000Z`), lte: new Date(`${dates[dates.length - 1]}T00:00:00.000Z`) } },
      orderBy: { stayDate: "asc" },
      select: { stayDate: true, occupancyPercent: true, currentRate: true, recommendedRate: true, competitorAvg: true, status: true },
    }),
    prisma.competitorSettings.findUnique({ where: { hotelTenantId }, select: { locationCode: true } }),
  ]);
  const days = rows.map((row) => ({
    date: row.stayDate.toISOString().slice(0, 10),
    occupancy: row.occupancyPercent,
    current: money(row.currentRate),
    recommended: money(row.recommendedRate),
    competitorAvg: money(row.competitorAvg),
    status: row.status,
  }));
  const competitors = settings?.locationCode == null ? [] : await prisma.competitor.findMany({
    where: { hotelTenantId, locationKey: String(settings.locationCode) },
    orderBy: [{ bestValueRank: "asc" }, { name: "asc" }],
    take: 20,
    select: { name: true, adr: true, rating: true, reviewCount: true, rawPayload: true },
  });
  const hotels = competitors.map((row) => ({
    name: row.name.startsWith(OWN_HOTEL_PREFIX) ? row.name.slice(OWN_HOTEL_PREFIX.length) : row.name,
    own: row.name.startsWith(OWN_HOTEL_PREFIX),
    adr: money(row.adr),
    rating: row.rating,
    reviewCount: row.reviewCount,
    distanceKm: row.rawPayload && typeof row.rawPayload === "object" && !Array.isArray(row.rawPayload) ? numberOrNull((row.rawPayload as { distKm?: unknown }).distKm) : null,
  }));
  const own = hotels.find((hotel) => hotel.own) ?? null;
  const others = hotels.filter((hotel) => !hotel.own);
  const occupancies = days.map((day) => day.occupancy);
  const priceFacts = {
    days: days.length,
    "average occupancy percent": average(occupancies),
    "lowest occupancy percent": occupancies.length ? Math.min(...occupancies) : null,
    "highest occupancy percent": occupancies.length ? Math.max(...occupancies) : null,
    "average current rate EUR": average(days.map((day) => day.current)),
    "average recommended rate EUR": average(days.map((day) => day.recommended)),
    "average competitor rate EUR": average(days.map((day) => day.competitorAvg)),
    "days that need an urgent change": days.filter((day) => day.status === "URGENT").length,
    "days that need an adjustment": days.filter((day) => day.status === "ADJUST").length,
    "days already at the right rate": days.filter((day) => day.status === "OPTIMAL").length,
  };
  const price = await ask(prisma, hotelTenantId, { task: "Summarize the price recommendation for these days.", ...priceFacts }, priceFallback(days.length, priceFacts["average occupancy percent"], priceFacts["average current rate EUR"], priceFacts["average recommended rate EUR"]));
  const closest = [...others].sort((left, right) => (left.distanceKm ?? 999) - (right.distanceKm ?? 999)).slice(0, 6);
  const competitor = await ask(prisma, hotelTenantId, {
    task: "In two sentences, compare our rate with these competitors. Name at most three hotels. Do not list every hotel.",
    own: own ? { name: own.name, adr: own.adr, rating: own.rating, reviewCount: own.reviewCount } : null,
    competitorCount: others.length,
    averageCompetitorRateEUR: average(others.map((hotel) => hotel.adr)),
    nearestCompetitors: closest,
  }, competitorFallback(own?.adr ?? null, average(others.map((hotel) => hotel.adr)), others.length));
  const generatedAt = new Date();
  await prisma.forecastNarrative.upsert({
    where: { hotelTenantId },
    create: {
      id: randomUUID(),
      hotelTenantId,
      priceEn: price.en,
      priceDe: price.de,
      priceIt: price.it,
      competitorEn: competitor.en,
      competitorDe: competitor.de,
      competitorIt: competitor.it,
      generatedAt,
    },
    update: {
      priceEn: price.en,
      priceDe: price.de,
      priceIt: price.it,
      competitorEn: competitor.en,
      competitorDe: competitor.de,
      competitorIt: competitor.it,
      generatedAt,
    },
  });
  return { price: Boolean(price.en), competitor: Boolean(competitor.en) };
}

export async function listForecastNarrative(prisma: PrismaClient, hotelTenantId: string) {
  const row = await prisma.forecastNarrative.findUnique({ where: { hotelTenantId } });
  if (!row) return { generatedAt: null, price: emptyText, competitor: emptyText };
  return {
    generatedAt: row.generatedAt.toISOString(),
    price: { en: row.priceEn, de: row.priceDe, it: row.priceIt },
    competitor: { en: row.competitorEn, de: row.competitorDe, it: row.competitorIt },
  };
}
