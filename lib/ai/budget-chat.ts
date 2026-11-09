import "server-only";

import { accessibleModules, currentAccessUser } from "../auth/module-access";
import { listHotelBudget } from "../budget/summaries";
import { prisma } from "../prisma";
import type { ChatTurn } from "../manuals/chat";
import { OWN_HOTEL_PREFIX, listCurrentRevenueWeek } from "../revenue/daily-recommendations";
import { listForecastNarrative } from "../revenue/narratives";
import { listRevenueOverview } from "../revenue/overview";
import { completeHotelChat, HotelAiNotConfiguredError } from "./complete";

type ChatLocale = "en" | "de" | "it";

const LANGUAGE: Record<ChatLocale, { name: string; rule: string }> = {
  en: { name: "English", rule: "The app language is English. Write the entire answer in English." },
  de: { name: "German", rule: "The app language is German. Write the entire answer in German (Deutsch)." },
  it: { name: "Italian", rule: "The app language is Italian. Write the entire answer in Italian (Italiano)." },
};

function parseLocale(value: unknown): ChatLocale {
  return value === "de" || value === "it" || value === "en" ? value : "en";
}

function money(value: number | null) {
  return value == null ? "–" : `${Math.round(value)}`;
}

function line(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function answerBudgetQuestion(question: string, history: ChatTurn[], locale?: unknown) {
  const query = question.trim().slice(0, 2000);
  if (!query) return { error: "EMPTY" as const };
  const chatLocale = parseLocale(locale);
  const language = LANGUAGE[chatLocale];
  const user = await currentAccessUser();
  if (!user) return { error: "UNAUTHENTICATED" as const };
  const modules = await accessibleModules(user);
  if (!modules.includes("budget") && !modules.includes("revenue") && !modules.includes("competitors")) {
    return {
      answer: chatLocale === "de"
        ? "Du kannst Budget, Umsatz und Mitbewerber nicht öffnen."
        : chatLocale === "it"
          ? "Non puoi aprire budget, ricavi e concorrenti."
          : "You cannot open budget, revenue, or competitors.",
    };
  }
  const hotelTenantId = user.hotel_tenant_id;
  const [overview, week, budget, narrative, settings] = await Promise.all([
    listRevenueOverview(prisma, hotelTenantId),
    listCurrentRevenueWeek(prisma, hotelTenantId),
    listHotelBudget(prisma, hotelTenantId),
    listForecastNarrative(prisma, hotelTenantId),
    prisma.competitorSettings.findUnique({ where: { hotelTenantId }, select: { locationCode: true } }),
  ]);
  const competitors = settings?.locationCode == null ? [] : await prisma.competitor.findMany({
    where: { hotelTenantId, locationKey: String(settings.locationCode) },
    orderBy: [{ bestValueRank: "asc" }, { name: "asc" }],
    take: 20,
    select: { name: true, adr: true, rating: true, reviewCount: true, rawPayload: true },
  });
  const competitorLines = competitors.map((row) => {
    const own = row.name.startsWith(OWN_HOTEL_PREFIX);
    const rawDistance = row.rawPayload && typeof row.rawPayload === "object" && !Array.isArray(row.rawPayload) ? (row.rawPayload as { distKm?: unknown }).distKm : null;
    const distance = rawDistance == null || rawDistance === "" ? null : Number(rawDistance);
    return line(`${own ? row.name.slice(OWN_HOTEL_PREFIX.length) : row.name}${own ? " (our hotel)" : ""} ADR ${money(row.adr == null ? null : Number(row.adr))} rating ${row.rating ?? "–"} reviews ${row.reviewCount ?? "–"} km ${distance != null && Number.isFinite(distance) ? distance : "–"}`);
  });
  const dayLines = week.rows.map((row) => line(`${row.date} occupancy ${row.occupancy}% current ${money(row.current)} recommended ${money(row.recommended)} competitorAvg ${money(row.competitorAvg)} ${row.status}${row.adopted ? " adopted" : ""}`));
  const monthLines = budget.months.map((row) => line(`${row.year}-${String(row.month).padStart(2, "0")} occupancy ${row.occupancy}% currentADR ${money(row.current)} recommendedADR ${money(row.recommended)} revenue ${Math.round(row.revenue)} lastYear ${Math.round(row.lastYearRevenue)} vsLastYear ${row.vsLastYear ?? "–"}%`));
  const categoryLines = budget.categories.map((row) => {
    const name = chatLocale === "de" ? row.nameDe || row.nameEn : chatLocale === "it" ? row.nameIt || row.nameEn : row.nameEn;
    return line(`${name} rooms ${row.rooms} occupancy ${row.occupancy}% currentADR ${money(row.current)} recommendedADR ${money(row.recommended)} share ${row.share}%`);
  });
  const priceSummary = chatLocale === "de" ? narrative.price.de : chatLocale === "it" ? narrative.price.it : narrative.price.en;
  const competitorSummary = chatLocale === "de" ? narrative.competitor.de : chatLocale === "it" ? narrative.competitor.it : narrative.competitor.en;
  const pack = [
    "Use only these stored forecast and competitor facts. Do not invent events, weather, rankings, or any number that is not here. If a section is empty, say it has not been calculated yet.",
    overview
      ? `CARDS occupancy30 ${overview.occupancy}% vsLastYearPoints ${overview.occupancyVsLastYear} currentRate ${money(overview.current)} recommendedRate ${money(overview.recommended)} seasonRevenue ${Math.round(overview.seasonRevenue)} seasonVsLastYear ${overview.seasonVsLastYear ?? "–"}%`
      : "CARDS not calculated yet.",
    `DAILY RECOMMENDATIONS\n${dayLines.join("\n") || "not calculated yet."}`,
    `BUDGET MONTHS (current month through December)\n${monthLines.join("\n") || "not calculated yet."}`,
    `ROOM CATEGORIES THIS MONTH\n${categoryLines.join("\n") || "not calculated yet."}`,
    `SAVED PRICE SUMMARY\n${priceSummary || "not calculated yet."}`,
    `SAVED COMPETITOR SUMMARY\n${competitorSummary || "not calculated yet."}`,
    `COMPETITORS\n${competitorLines.join("\n") || "none stored."}`,
  ].join("\n\n").slice(0, 12000);
  const prior = history.slice(-6).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) }));
  try {
    const answer = await completeHotelChat(prisma, hotelTenantId, [
      {
        role: "system",
        content: `${language.rule} Never switch language. You are the hotel budget assistant. Answer questions about the forecast, daily price recommendations, budget months, room categories, and competitors. Use only the facts in the user message. If a fact is missing, say you do not know. Do not claim you changed any rate or booking.`,
      },
      ...prior,
      { role: "user", content: `App language: ${language.name}. Reply only in ${language.name}.\n\nQuestion:\n${query}\n\nFacts:\n${pack}` },
    ]);
    if (answer) return { answer };
    return {
      answer: chatLocale === "de"
        ? "Die KI-Antwort ist gerade nicht verfügbar. Ich erfinde keine Forecast- oder Mitbewerberzahlen."
        : chatLocale === "it"
          ? "La risposta IA non è disponibile. Non invento dati di previsione o dei concorrenti."
          : "The language model is unavailable. I will not invent forecast or competitor figures.",
    };
  } catch (error) {
    if (error instanceof HotelAiNotConfiguredError) {
      return {
        answer: chatLocale === "de"
          ? "Hinterlege in den Einstellungen einen KI-Schlüssel, damit der Assistent antworten kann."
          : chatLocale === "it"
            ? "In Impostazioni aggiungi una chiave IA perché l’assistente possa rispondere."
            : "Add an AI key in Settings so the assistant can answer.",
      };
    }
    return { error: "MODEL_FAILED" as const };
  }
}
