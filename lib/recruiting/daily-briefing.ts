import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../app/generated/prisma/client";

const DAY = 24 * 60 * 60 * 1000;

type Facts = {
  hotel: string;
  asOf: string;
  activeJobs: Array<{ title: string; daysLive: number; clicks: number; applications: number }>;
  draftJobs: number;
  archivedJobs: number;
  applicationsToday: number;
  applications7d: number;
  byRecommendation: Record<string, number>;
  byStage: Record<string, number>;
  pendingAi: number;
  recommended: Array<{ name: string; job: string; score: number | null }>;
  possible: Array<{ name: string; job: string; score: number | null }>;
  needsReview: Array<{ name: string; job: string; score: number | null }>;
  notAFit: Array<{ name: string; job: string; score: number | null }>;
  invited: Array<{ name: string; job: string }>;
  openOffers: Array<{ name: string; job: string }>;
  hired7d: number;
  rejected7d: number;
  quietJobs: Array<{ title: string; daysLive: number }>;
  highClicksLowApps: Array<{ title: string; daysLive: number; clicks: number; applications: number }>;
};

function daysBetween(from: Date, to: Date) {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / DAY));
}

async function completeJson(messages: { role: string; content: string }[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  } | null;
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI request failed.");
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty model reply.");
  return JSON.parse(content) as Record<string, unknown>;
}

export async function collectRecruitingFacts(prisma: PrismaClient, hotelTenantId: string): Promise<Facts> {
  const now = new Date();
  const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const hotel = await prisma.hotelTenant.findFirst({
    where: { id: hotelTenantId },
    select: { hotelNameEn: true, hotelNameDe: true, hotelNameIt: true },
  });
  const [jobs, applications] = await Promise.all([
    prisma.recruitingJob.findMany({
      where: { hotelTenantId },
      select: { title: true, status: true, clickCount: true, createdAt: true, _count: { select: { applications: true } } },
    }),
    prisma.recruitingApplication.findMany({
      where: { hotelTenantId },
      select: {
        firstName: true,
        lastName: true,
        stage: true,
        aiStatus: true,
        aiScore: true,
        aiRecommendation: true,
        createdAt: true,
        job: { select: { title: true } },
      },
    }),
  ]);
  const activeJobs = jobs.filter((job) => job.status === "ACTIVE").map((job) => ({
    title: job.title,
    daysLive: daysBetween(job.createdAt, now),
    clicks: job.clickCount,
    applications: job._count.applications,
  }));
  const byRecommendation: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  for (const row of applications) {
    const rec = row.aiStatus === "READY" && row.aiRecommendation ? row.aiRecommendation : row.aiStatus === "PENDING" ? "pending" : "unscored";
    byRecommendation[rec] = (byRecommendation[rec] || 0) + 1;
    byStage[row.stage] = (byStage[row.stage] || 0) + 1;
  }
  const ranked = (value: string) =>
    applications
      .filter((row) => row.aiRecommendation === value && row.stage === "NEW")
      .sort((left, right) => (right.aiScore ?? 0) - (left.aiScore ?? 0))
      .slice(0, 8)
      .map((row) => ({ name: `${row.firstName} ${row.lastName}`.trim(), job: row.job.title, score: row.aiScore }));
  const openOffers = applications
    .filter((row) => row.stage === "OFFER")
    .slice(0, 8)
    .map((row) => ({ name: `${row.firstName} ${row.lastName}`.trim(), job: row.job.title }));
  const invited = applications
    .filter((row) => row.stage === "INVITED")
    .slice(0, 8)
    .map((row) => ({ name: `${row.firstName} ${row.lastName}`.trim(), job: row.job.title }));
  return {
    hotel: hotel?.hotelNameEn || hotel?.hotelNameDe || hotel?.hotelNameIt || "Hotel",
    asOf: now.toISOString().slice(0, 10),
    activeJobs,
    draftJobs: jobs.filter((job) => job.status === "DRAFT").length,
    archivedJobs: jobs.filter((job) => job.status === "ARCHIVED").length,
    applicationsToday: applications.filter((row) => row.createdAt >= startToday).length,
    applications7d: applications.filter((row) => row.createdAt >= weekAgo).length,
    byRecommendation,
    byStage,
    pendingAi: applications.filter((row) => row.aiStatus === "PENDING").length,
    recommended: ranked("recommended"),
    possible: ranked("possible"),
    needsReview: ranked("needsReview"),
    notAFit: ranked("notAFit"),
    invited,
    openOffers,
    hired7d: applications.filter((row) => row.stage === "HIRED" && row.createdAt >= weekAgo).length,
    rejected7d: applications.filter((row) => row.stage === "REJECTED" && row.createdAt >= weekAgo).length,
    quietJobs: activeJobs.filter((job) => job.applications === 0 && job.daysLive >= 7),
    highClicksLowApps: activeJobs.filter((job) => job.clicks >= 10 && job.applications === 0).slice(0, 6),
  };
}

function clampBanner(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return "";
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 3);
  return sentences.join(" ").slice(0, 500);
}

function namesLine(rows: Array<{ name: string; job: string; score?: number | null }>) {
  return rows.slice(0, 2).map((row) => `${row.name} (${row.job}${row.score != null ? `, ${row.score}%` : ""})`).join("; ");
}

function fallbackBodies(facts: Facts) {
  const rec = facts.byRecommendation.recommended || 0;
  const possible = facts.byRecommendation.possible || 0;
  const notFit = facts.byRecommendation.notAFit || 0;
  const names = namesLine(facts.recommended) || namesLine(facts.possible);
  const quiet = facts.quietJobs.slice(0, 2).map((job) => `${job.title} (${job.daysLive}d)`).join("; ");
  const offers = facts.openOffers.slice(0, 2).map((row) => `${row.name} / ${row.job}`).join("; ");
  const actionEn = names
    ? `Interview first: ${names}.`
    : quiet
      ? `No applications yet on: ${quiet}.`
      : offers
        ? `Open offers: ${offers}.`
        : facts.pendingAi
          ? `${facts.pendingAi} application(s) still waiting for an AI score.`
          : "Nothing urgent in New right now.";
  const actionDe = names
    ? `Zuerst sprechen: ${names}.`
    : quiet
      ? `Noch keine Bewerbungen: ${quiet}.`
      : offers
        ? `Offene Angebote: ${offers}.`
        : facts.pendingAi
          ? `${facts.pendingAi} Bewerbung(en) ohne KI-Score.`
          : "Nichts Dringendes in Neu.";
  const actionIt = names
    ? `Colloquio prima: ${names}.`
    : quiet
      ? `Nessuna candidatura su: ${quiet}.`
      : offers
        ? `Offerte aperte: ${offers}.`
        : facts.pendingAi
          ? `${facts.pendingAi} candidatura/e senza punteggio IA.`
          : "Niente urgente in Nuovi.";
  const extraEn = quiet && names ? `Quiet jobs: ${quiet}.` : offers && names ? `Open offers: ${offers}.` : "";
  const extraDe = quiet && names ? `Stille Stellen: ${quiet}.` : offers && names ? `Offene Angebote: ${offers}.` : "";
  const extraIt = quiet && names ? `Annunci fermi: ${quiet}.` : offers && names ? `Offerte aperte: ${offers}.` : "";
  return {
    bodyEn: [
      `${facts.applicationsToday} new today, ${facts.applications7d} in 7 days. ${facts.activeJobs.length} live job(s).`,
      `AI: ${rec} recommended, ${possible} acceptable, ${notFit} not a fit.`,
      extraEn ? `${actionEn} ${extraEn}` : actionEn,
    ].join(" "),
    bodyDe: [
      `${facts.applicationsToday} neu heute, ${facts.applications7d} in 7 Tagen. ${facts.activeJobs.length} aktive Stelle(n).`,
      `KI: ${rec} empfohlen, ${possible} akzeptabel, ${notFit} nicht passend.`,
      extraDe ? `${actionDe} ${extraDe}` : actionDe,
    ].join(" "),
    bodyIt: [
      `${facts.applicationsToday} oggi, ${facts.applications7d} in 7 giorni. ${facts.activeJobs.length} annuncio/i attivi.`,
      `IA: ${rec} consigliati, ${possible} accettabili, ${notFit} non adatti.`,
      extraIt ? `${actionIt} ${extraIt}` : actionIt,
    ].join(" "),
  };
}

async function writeBodies(prisma: PrismaClient, hotelTenantId: string, bodies: { bodyEn: string; bodyDe: string; bodyIt: string }) {
  const generatedAt = new Date();
  const existing = await prisma.hotelAiRecommendation.findUnique({
    where: { hotelTenantId_place: { hotelTenantId, place: "RECRUITING" } },
  });
  if (existing) {
    await prisma.hotelAiRecommendation.update({
      where: { hotelTenantId_place: { hotelTenantId, place: "RECRUITING" } },
      data: { ...bodies, generatedAt },
    });
    return;
  }
  await prisma.hotelAiRecommendation.create({
    data: { id: randomUUID(), hotelTenantId, place: "RECRUITING", ...bodies, generatedAt },
  });
}

export async function generateHotelRecruitingBriefing(prisma: PrismaClient, hotelTenantId: string) {
  const facts = await collectRecruitingFacts(prisma, hotelTenantId);
  const fallback = fallbackBodies(facts);
  try {
    const parsed = await completeJson([
      {
        role: "system",
        content: "You write a 2-3 sentence recruiting hub banner for one hotel. Use only the JSON facts. Do not invent people, jobs, or scores. Return JSON only.",
      },
      {
        role: "user",
        content: `Write exactly 2 or 3 short sentences for the recruiting hub banner. Prioritize: new applications, AI score counts, who to interview next, one quiet job or open offer if present. Do not invent names, jobs, days, or scores.\nReturn JSON: {"bodyEn":"...","bodyDe":"...","bodyIt":"..."}\nEach body is 2-3 sentences in that language. No lists, no more than 3 sentences.\n\nFacts:\n${JSON.stringify(facts)}`,
      },
    ]);
    const bodyEn = clampBanner(typeof parsed?.bodyEn === "string" ? parsed.bodyEn : "");
    const bodyDe = clampBanner(typeof parsed?.bodyDe === "string" ? parsed.bodyDe : "");
    const bodyIt = clampBanner(typeof parsed?.bodyIt === "string" ? parsed.bodyIt : "");
    const bodies = bodyEn && bodyDe && bodyIt ? { bodyEn, bodyDe, bodyIt } : fallback;
    await writeBodies(prisma, hotelTenantId, bodies);
    return { hotelTenantId, usedModel: Boolean(bodyEn && bodyDe && bodyIt) };
  } catch {
    await writeBodies(prisma, hotelTenantId, fallback);
    return { hotelTenantId, usedModel: false };
  }
}
