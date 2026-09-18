import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../app/generated/prisma/client";
import { completeHotelChatJson } from "../ai/complete";

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
  return sentences.join(" ").slice(0, 420);
}

function isOpsBriefing(value: string) {
  if (!value || !/\d/.test(value)) return false;
  return !/join our team|don'?t miss|exciting opportunit|vibrant community|apply today|be part of|come work|we are hiring|bewirb dich|candidati oggi/i.test(value);
}

function namesLine(rows: Array<{ name: string; job: string; score?: number | null }>) {
  return rows.slice(0, 2).map((row) => `${row.name} (${row.job}${row.score != null ? `, ${row.score}%` : ""})`).join("; ");
}

function fallbackBodies(facts: Facts) {
  const rec = facts.byRecommendation.recommended || 0;
  const possible = facts.byRecommendation.possible || 0;
  const review = facts.byRecommendation.needsReview || 0;
  const notFit = facts.byRecommendation.notAFit || 0;
  const names = namesLine(facts.recommended);
  const maybe = namesLine(facts.possible);
  const live = facts.activeJobs.slice(0, 3).map((job) => `${job.title} ${job.daysLive}d, ${job.applications} app(s)`).join("; ");
  const quiet = facts.quietJobs.slice(0, 2).map((job) => `${job.title} (${job.daysLive}d)`).join("; ");
  const offers = facts.openOffers.slice(0, 2).map((row) => `${row.name} / ${row.job}`).join("; ");
  const whoEn = names ? `Interview first: ${names}.` : maybe ? `Worth a look: ${maybe}.` : "No AI-recommended applicants in New.";
  const whoDe = names ? `Zuerst sprechen: ${names}.` : maybe ? `Anschauen: ${maybe}.` : "Keine KI-empfohlenen Bewerber in Neu.";
  const whoIt = names ? `Colloquio prima: ${names}.` : maybe ? `Da valutare: ${maybe}.` : "Nessun candidato consigliato in Nuovi.";
  const tailEn = quiet ? `No applications after 7+ days: ${quiet}.` : offers ? `Open offers waiting: ${offers}.` : facts.draftJobs ? `${facts.draftJobs} draft job(s) unpublished.` : "";
  const tailDe = quiet ? `Keine Bewerbung nach 7+ Tagen: ${quiet}.` : offers ? `Offene Angebote: ${offers}.` : facts.draftJobs ? `${facts.draftJobs} Entwurf(e) unveröffentlicht.` : "";
  const tailIt = quiet ? `Nessuna candidatura da 7+ giorni: ${quiet}.` : offers ? `Offerte aperte: ${offers}.` : facts.draftJobs ? `${facts.draftJobs} bozza/e non pubblicate.` : "";
  return {
    bodyEn: clampBanner([
      `${facts.applicationsToday} new application(s) today, ${facts.applications7d} in 7 days. Live: ${live || "none"}.`,
      `AI scores: ${rec} recommended, ${possible} acceptable, ${review} needs review, ${notFit} not a fit${facts.pendingAi ? `, ${facts.pendingAi} pending` : ""}. ${whoEn}`,
      tailEn,
    ].filter(Boolean).join(" ")),
    bodyDe: clampBanner([
      `${facts.applicationsToday} neue Bewerbung(en) heute, ${facts.applications7d} in 7 Tagen. Aktiv: ${live || "keine"}.`,
      `KI: ${rec} empfohlen, ${possible} akzeptabel, ${review} prüfen, ${notFit} nicht passend${facts.pendingAi ? `, ${facts.pendingAi} offen` : ""}. ${whoDe}`,
      tailDe,
    ].filter(Boolean).join(" ")),
    bodyIt: clampBanner([
      `${facts.applicationsToday} candidatura/e oggi, ${facts.applications7d} in 7 giorni. Attivi: ${live || "nessuno"}.`,
      `Punteggi IA: ${rec} consigliati, ${possible} accettabili, ${review} da rivedere, ${notFit} non adatti${facts.pendingAi ? `, ${facts.pendingAi} in attesa` : ""}. ${whoIt}`,
      tailIt,
    ].filter(Boolean).join(" ")),
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
    const parsed = await completeHotelChatJson(prisma, hotelTenantId, [
      {
        role: "system",
        content: "You rewrite an internal recruiting operations note for hotel managers. Keep numbers and names. Never write a job ad, never invite people to apply, never say join our team. Return JSON only.",
      },
      {
        role: "user",
        content: `Keep this as 2-3 short sentences of manager recommendations (counts, AI scores, who to interview, quiet jobs, open offers). Do not add new facts.\nReturn JSON: {"bodyEn":"...","bodyDe":"...","bodyIt":"..."}\n\nEnglish:\n${fallback.bodyEn}\n\nGerman:\n${fallback.bodyDe}\n\nItalian:\n${fallback.bodyIt}`,
      },
    ]);
    const bodyEn = clampBanner(typeof parsed?.bodyEn === "string" ? parsed.bodyEn : "");
    const bodyDe = clampBanner(typeof parsed?.bodyDe === "string" ? parsed.bodyDe : "");
    const bodyIt = clampBanner(typeof parsed?.bodyIt === "string" ? parsed.bodyIt : "");
    const bodies = isOpsBriefing(bodyEn) && isOpsBriefing(bodyDe) && isOpsBriefing(bodyIt)
      ? { bodyEn, bodyDe, bodyIt }
      : fallback;
    await writeBodies(prisma, hotelTenantId, bodies);
    return { hotelTenantId, usedModel: bodies !== fallback };
  } catch {
    await writeBodies(prisma, hotelTenantId, fallback);
    return { hotelTenantId, usedModel: false };
  }
}
