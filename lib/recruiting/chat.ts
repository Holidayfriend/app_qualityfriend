import "server-only";

import { prisma } from "../prisma";
import type { ChatTurn } from "../manuals/chat";
import { recruitingActor } from "./access";
import { parseQuizAnswers } from "./application-fields";
import { readRecruitingCvText, readRecruitingExtraText, unpackCvRef } from "./cv-storage";

type ChatLocale = "en" | "de" | "it";

const LANGUAGE: Record<ChatLocale, { name: string; rule: string }> = {
  en: { name: "English", rule: "The app language is English. Write the entire answer in English." },
  de: { name: "German", rule: "The app language is German. Write the entire answer in German (Deutsch)." },
  it: { name: "Italian", rule: "The app language is Italian. Write the entire answer in Italian (Italiano)." },
};

const COUNT = /\b(how many.{0,40}(applications|applicants|jobs?|candidates|ads?|anzeigen|stellen)|application count|wie viele.{0,40}(bewerb|stellen|kandidat|anzeigen)|quante.{0,40}(candidature|annunci)|pipeline|statistik)\b/i;
const JOBS_COUNT = /\b((active|live|open|offene|attive)\s+(jobs?|stellen|ads?|anzeigen)|stellenanzeigen|job ads?|how many.{0,40}jobs?)\b/i;
const YEARS = /\b((how many|wie viele|quanti|quante).{0,40}(experience|exparence|erfahrung|esperienza|years?|jahre|anni)|(years?|jahre|anni).{0,20}(experience|erfahrung|esperienza)|berufserfahrung)\b/i;
const FACTS = /\b(experience|exparence|erfahrung|esperienza|years?|jahre|anni|cv|lebenslauf|employer|worked|gearbeitet)\b/i;
const PERSON = /\b(cv|lebenslauf|experience|exparence|erfahrung|esperienza|candidate|bewerber|candidat|interview|kompetenz|competenc|score|empfohlen|recommended|why .+ best|beste[rn]?)\b/i;
const JOB_FOCUS = /\b(job ad|stellenanzeige|annuncio|posting|optimize|optimier|wording|quiz|funnel)\b/i;

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function parseLocale(value: unknown): ChatLocale {
  return value === "de" || value === "it" || value === "en" ? value : "en";
}

function hay(...parts: string[]) {
  return parts.join(" ").toLowerCase().normalize("NFKD");
}

async function completeWithOpenAi(messages: { role: string; content: string }[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0, messages }),
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
  return content;
}

type ApplicantRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  message: string;
  stage: string;
  locale: string;
  cvFileName: string;
  answers: unknown;
  aiStatus: string;
  aiScore: number | null;
  aiRecommendation: string | null;
  aiSocial: number | null;
  aiProfessional: number | null;
  aiMethodical: number | null;
  aiPersonal: number | null;
  createdAt: Date;
  job: { id: string; title: string; titleDe: string; titleIt: string; format: string; status: string; workType: string; startFrom: string; location: string; notes: string; description: string; clickCount: number };
  files: { fileName: string; storageKey: string; mimeType: string }[];
};

function fullName(row: { firstName: string; lastName: string }) {
  return `${row.firstName} ${row.lastName}`.trim();
}

function matchesPerson(row: ApplicantRow, text: string) {
  const blob = hay(text);
  const first = row.firstName.trim().toLowerCase();
  const last = row.lastName.trim().toLowerCase();
  const full = fullName(row).toLowerCase();
  if (full.length > 3 && blob.includes(full)) return true;
  if (last.length > 2 && blob.includes(last) && (!first || blob.includes(first) || first.length <= 2)) return true;
  if (first.length > 3 && blob.includes(first) && last.length > 2 && blob.includes(last)) return true;
  if (first.length > 4 && blob.includes(first) && !last) return true;
  return false;
}

function matchesJob(job: ApplicantRow["job"], text: string) {
  const blob = hay(text);
  return [job.title, job.titleDe, job.titleIt].some((title) => title.trim().length > 3 && blob.includes(title.trim().toLowerCase()));
}

async function sourceTexts(row: ApplicantRow) {
  const cv = unpackCvRef(row.cvFileName);
  const cvText = cv.storageKey ? await readRecruitingCvText(cv.storageKey) : "";
  const extras: string[] = [];
  for (const file of row.files) {
    if (file.mimeType.startsWith("image/")) continue;
    const text = await readRecruitingExtraText(file.storageKey);
    if (text) extras.push(`Extra file ${file.fileName}:\n${text.slice(0, 4000)}`);
  }
  const quiz = quizPack(row);
  const quizText = quiz === "(no quiz answers)" ? "" : quiz;
  return {
    cvName: cv.displayName || (cv.storageKey ? "CV" : ""),
    cvText,
    extras,
    message: row.message.trim(),
    quizText,
    hasCvFile: Boolean(cv.storageKey),
  };
}

function hasStatedFacts(source: Awaited<ReturnType<typeof sourceTexts>>) {
  return Boolean(source.cvText || source.quizText || source.extras.length || source.message.length > 40);
}

function statesDuration(source: Awaited<ReturnType<typeof sourceTexts>>) {
  const blob = `${source.cvText}\n${source.message}\n${source.quizText}\n${source.extras.join("\n")}`;
  return /\b\d{1,2}\s*(\+|plus)?\s*(years?|yrs?|jahre|anni)\b/i.test(blob)
    || /\b(20\d{2}|19\d{2})\s*[-–/]\s*(20\d{2}|19\d{2}|present|current|heute|attuale|oggi)\b/i.test(blob);
}

async function cvPack(row: ApplicantRow) {
  const source = await sourceTexts(row);
  const parts: string[] = [];
  if (source.cvText) parts.push(`CV (${source.cvName}):\n${source.cvText.slice(0, 10000)}`);
  else if (source.hasCvFile) parts.push(`CV file on record: ${source.cvName}. INDEXED TEXT: NONE. Do not invent CV content.`);
  else parts.push("CV: (none uploaded). Do not invent a CV.");
  parts.push(...source.extras);
  return parts.join("\n\n");
}

function quizPack(row: ApplicantRow) {
  const answers = parseQuizAnswers(row.answers)
    .map((item) => `${item.pageName ? `${item.pageName} / ` : ""}${item.prompt}: ${item.value}`)
    .join("\n");
  return answers || "(no quiz answers)";
}

function jobText(job: ApplicantRow["job"]) {
  return [
    `Title: ${job.title}`,
    job.titleDe ? `Title DE: ${job.titleDe}` : "",
    job.titleIt ? `Title IT: ${job.titleIt}` : "",
    `Status: ${job.status}`,
    `Format: ${job.format}`,
    job.workType ? `Work type: ${job.workType}` : "",
    job.startFrom ? `Start: ${job.startFrom}` : "",
    job.location ? `Location: ${job.location}` : "",
    job.notes ? `Benefits / notes: ${job.notes}` : "",
    `Clicks: ${job.clickCount}`,
    stripHtml(job.description).slice(0, 4000),
  ].filter(Boolean).join("\n");
}

function applicantSummary(row: ApplicantRow) {
  return [
    `Name: ${fullName(row)}`,
    `Job: ${row.job.title}`,
    `Stage: ${row.stage}`,
    `Applied: ${row.createdAt.toISOString().slice(0, 10)}`,
    `AI status: ${row.aiStatus}`,
    row.aiScore != null ? `Stored AI score: ${row.aiScore}% (${row.aiRecommendation || "–"})` : "Stored AI score: not ready",
    row.aiSocial != null ? `Competencies social/professional/methodical/personal: ${row.aiSocial}/${row.aiProfessional}/${row.aiMethodical}/${row.aiPersonal}` : "",
    row.email ? `Email: ${row.email}` : "",
    row.phone ? `Phone: ${row.phone}` : "",
  ].filter(Boolean).join("\n");
}

async function oneCandidatePack(row: ApplicantRow, factsOnly: boolean) {
  const source = await sourceTexts(row);
  const head = factsOnly
    ? [
      "PACK TYPE: candidate facts only.",
      "The vacancy title is not this person's experience.",
      `Applied to job title only: ${row.job.title}`,
      `Applicant: ${fullName(row)} · stage ${row.stage} · applied ${row.createdAt.toISOString().slice(0, 10)}`,
    ]
    : [
      "PACK TYPE: one candidate.",
      "Job posting (vacancy text, not the candidate's CV):\n" + jobText(row.job),
      "Applicant record:\n" + applicantSummary(row),
    ];
  return [
    ...head,
    source.message ? `Application message:\n${source.message}` : "Application message: (none)",
    source.quizText ? `Quiz answers:\n${source.quizText}` : "",
    await cvPack(row),
  ].filter(Boolean).join("\n\n").slice(0, 18000);
}

async function countsPack(hotelTenantId: string) {
  const [jobs, stages, recent] = await Promise.all([
    prisma.recruitingJob.findMany({
      where: { hotelTenantId },
      select: { title: true, status: true, format: true, clickCount: true, _count: { select: { applications: true } } },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.recruitingApplication.groupBy({
      by: ["stage"],
      where: { hotelTenantId },
      _count: { _all: true },
    }),
    prisma.recruitingApplication.findMany({
      where: { hotelTenantId },
      select: { firstName: true, lastName: true, stage: true, aiScore: true, aiRecommendation: true, createdAt: true, job: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const jobLines = jobs.map((job) => `${job.title} [${job.status}/${job.format}] clicks=${job.clickCount} applications=${job._count.applications}`).join("\n") || "(no jobs)";
  const stageLines = stages.map((row) => `${row.stage}: ${row._count._all}`).join("\n") || "(no applications)";
  const recentLines = recent.map((row) => `${fullName(row)} → ${row.job.title} · ${row.stage} · score ${row.aiScore ?? "–"} ${row.aiRecommendation ?? ""}`).join("\n") || "(none)";
  const byStatus = { ACTIVE: 0, DRAFT: 0, ARCHIVED: 0 };
  for (const job of jobs) {
    if (job.status in byStatus) byStatus[job.status as keyof typeof byStatus] += 1;
  }
  return [
    "PACK TYPE: counts from our database. Repeat these numbers; do not invent extra applications or jobs.",
    `Job status totals: ACTIVE=${byStatus.ACTIVE} DRAFT=${byStatus.DRAFT} ARCHIVED=${byStatus.ARCHIVED} (ACTIVE means live/published).`,
    `Pipeline by stage:\n${stageLines}`,
    `Jobs:\n${jobLines}`,
    `Latest applications:\n${recentLines}`,
  ].join("\n\n");
}

async function jobsCountPack(hotelTenantId: string) {
  const [byStatus, active] = await Promise.all([
    prisma.recruitingJob.groupBy({
      by: ["status"],
      where: { hotelTenantId },
      _count: { _all: true },
    }),
    prisma.recruitingJob.findMany({
      where: { hotelTenantId, status: "ACTIVE" },
      select: { title: true, format: true, clickCount: true, _count: { select: { applications: true } } },
      orderBy: { updatedAt: "desc" },
      take: 80,
    }),
  ]);
  const totals = { ACTIVE: 0, DRAFT: 0, ARCHIVED: 0 };
  for (const row of byStatus) {
    if (row.status in totals) totals[row.status as keyof typeof totals] = row._count._all;
  }
  const list = active.map((job) => `${job.title} · ${job.format} · clicks ${job.clickCount} · applications ${job._count.applications}`).join("\n") || "(none)";
  return [
    "PACK TYPE: job counts. ACTIVE = live ads. Do not list candidates. Do not invent jobs.",
    `ACTIVE jobs: ${totals.ACTIVE}`,
    `DRAFT jobs: ${totals.DRAFT}`,
    `ARCHIVED jobs: ${totals.ARCHIVED}`,
    `Active job titles:\n${list}`,
  ].join("\n\n");
}

async function oneJobPack(hotelTenantId: string, titleMatch: string) {
  const jobs = await prisma.recruitingJob.findMany({
    where: { hotelTenantId },
    select: {
      id: true, title: true, titleDe: true, titleIt: true, format: true, status: true, workType: true, startFrom: true, location: true, notes: true, description: true, clickCount: true,
    },
    take: 40,
  });
  const job = jobs.find((item) => matchesJob(item, titleMatch)) || jobs.find((item) => hay(titleMatch).includes(item.title.toLowerCase()));
  if (!job) return null;
  const apps = await prisma.recruitingApplication.findMany({
    where: { hotelTenantId, jobId: job.id },
    select: { firstName: true, lastName: true, stage: true, aiScore: true, aiRecommendation: true, createdAt: true, message: true },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const list = apps.map((row) => `${fullName(row)} · ${row.stage} · score ${row.aiScore ?? "–"} ${row.aiRecommendation ?? ""} · ${row.createdAt.toISOString().slice(0, 10)}`).join("\n") || "(no applications)";
  return [
    "PACK TYPE: one job. Applicant lines are summaries only — no full CVs. If the user asks about one person by name, wait for a follow-up so we can load that CV.",
    "Job posting:\n" + jobText(job),
    `Applications (${apps.length}):\n${list}`,
  ].join("\n\n").slice(0, 12000);
}

async function directoryPack(hotelTenantId: string) {
  const apps = await prisma.recruitingApplication.findMany({
    where: { hotelTenantId },
    select: { firstName: true, lastName: true, stage: true, aiScore: true, aiRecommendation: true, job: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const lines = apps.map((row) => `${fullName(row)} · ${row.job.title} · ${row.stage} · ${row.aiScore ?? "–"}% ${row.aiRecommendation ?? ""}`).join("\n") || "(no applications)";
  return [
    "PACK TYPE: directory. No CV text included. If they name a person, we will load that CV on the next turn.",
    `Applicants:\n${lines}`,
  ].join("\n\n");
}

export async function answerRecruitingQuestion(question: string, history: ChatTurn[], locale?: unknown) {
  const query = question.trim().slice(0, 2000);
  if (!query) return { error: "EMPTY" as const };
  const actor = await recruitingActor();
  const chatLocale = parseLocale(locale);
  const language = LANGUAGE[chatLocale];
  if (!actor) {
    const denied = {
      en: "You do not have access to Recruiting, so this assistant cannot see jobs or CVs.",
      de: "Du hast keinen Zugriff auf Recruiting. Dieser Assistent sieht keine Stellen oder Lebensläufe.",
      it: "Non hai accesso al recruiting, quindi questo assistente non vede annunci o CV.",
    };
    return { answer: denied[chatLocale] };
  }

  const applicants = await prisma.recruitingApplication.findMany({
    where: { hotelTenantId: actor.hotel_tenant_id },
    include: {
      job: {
        select: {
          id: true, title: true, titleDe: true, titleIt: true, format: true, status: true, workType: true, startFrom: true, location: true, notes: true, description: true, clickCount: true,
        },
      },
      files: { select: { fileName: true, storageKey: true, mimeType: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  if (!applicants.length) {
    const jobs = await prisma.recruitingJob.count({ where: { hotelTenantId: actor.hotel_tenant_id } });
    if (!jobs) {
      return {
        answer: chatLocale === "de"
          ? "Es gibt noch keine Stellenanzeigen oder Bewerbungen in Recruiting."
          : chatLocale === "it"
            ? "Non ci sono ancora annunci o candidature in Recruiting."
            : "There are no job ads or applications in Recruiting yet.",
      };
    }
  }

  const historyText = history.slice(-6).map((turn) => turn.content).join("\n");
  const jobsQuestion = JOBS_COUNT.test(query) || (COUNT.test(query) && /\b(jobs?|stellen|anzeigen|ads?|annunci)\b/i.test(query) && !YEARS.test(query));
  const countsQuestion = COUNT.test(query) && !YEARS.test(query);
  const namedNow = applicants.filter((row) => matchesPerson(row, query));
  const personFollowUp = !jobsQuestion && !countsQuestion && namedNow.length === 0 && (FACTS.test(query) || YEARS.test(query) || PERSON.test(query));
  const namedPool = namedNow.length ? namedNow : personFollowUp ? applicants.filter((row) => matchesPerson(row, historyText)) : [];
  const uniqueNamed = [...new Map(namedPool.map((row) => [row.id, row])).values()];

  let pack: string;
  let instruction: string;

  if (jobsQuestion) {
    pack = await jobsCountPack(actor.hotel_tenant_id);
    instruction = "Answer with the ACTIVE job count from the pack. You may list those titles. Do not mention candidates unless asked.";
  } else if (countsQuestion) {
    pack = await countsPack(actor.hotel_tenant_id);
    instruction = "Use only these database counts. Do not invent people or jobs.";
  } else if (uniqueNamed.length > 1) {
    const list = uniqueNamed.slice(0, 8).map((row) => `${fullName(row)} (${row.job.title})`).join(", ");
    return {
      answer: chatLocale === "de"
        ? `Mehrere Bewerber passen: ${list}. Bitte nenne den vollen Namen.`
        : chatLocale === "it"
          ? `Più candidati corrispondono: ${list}. Indica il nome completo.`
          : `Several candidates match: ${list}. Please give the full name.`,
    };
  } else if (uniqueNamed.length === 1) {
    const person = uniqueNamed[0];
    const factsQuestion = FACTS.test(query);
    const yearsQuestion = YEARS.test(query);
    if (factsQuestion || yearsQuestion) {
      const source = await sourceTexts(person);
      if (!hasStatedFacts(source) || (yearsQuestion && !statesDuration(source))) {
        const name = fullName(person);
        const missingCv = source.hasCvFile && !source.cvText;
        return {
          answer: chatLocale === "de"
            ? `${name}: In Bewerbung, Quiz und indexiertem Lebenslauf stehen keine Jahre oder Daten zur Erfahrung.${missingCv ? " Lebenslauf-Text ist noch nicht indexiert — in der Bewerbung „Erneut von KI prüfen“." : ""} Ich rate nicht.`
            : chatLocale === "it"
              ? `${name}: candidatura, quiz e CV indicizzato non indicano anni o date di esperienza.${missingCv ? " Testo CV non indicizzato — usa Ricalcola IA sulla candidatura." : ""} Non lo invento.`
              : `${name}: the application, quiz, and indexed CV do not state years or dates of experience.${missingCv ? " CV text is not indexed yet — use Re-check from AI on the application." : ""} I will not guess.`,
        };
      }
    }
    pack = await oneCandidatePack(person, factsQuestion);
    instruction = factsQuestion
      ? "Use ONLY CV text, quiz answers, and the application message. Quote years only if they appear there. Never treat the job ad as this person's history. Ignore earlier assistant messages."
      : "Job posting text is the vacancy, not the candidate. If experience is not in CV/quiz/message, say it is not stated. Do not invent a new official score.";
  } else if (JOB_FOCUS.test(query) || (!PERSON.test(query) && applicants.some((row) => matchesJob(row.job, query)))) {
    pack = (await oneJobPack(actor.hotel_tenant_id, query)) || await directoryPack(actor.hotel_tenant_id);
    instruction = "Help with this job ad and its application list. Do not rewrite live ads as if already saved. Do not invent CV facts.";
  } else {
    pack = PERSON.test(query)
      ? await directoryPack(actor.hotel_tenant_id)
      : await countsPack(actor.hotel_tenant_id);
    instruction = PERSON.test(query)
      ? "No named candidate in this question. List who exists and ask for a name before discussing a CV."
      : "Give a short recruiting overview from these counts. Ask for a candidate name to inspect a CV.";
  }

  try {
    const prior = FACTS.test(query) || YEARS.test(query) || JOBS_COUNT.test(query) || COUNT.test(query)
      ? history.slice(-6).filter((turn) => turn.role === "user").map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) }))
      : history.slice(-6).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) }));
    const answer = await completeWithOpenAi([
      {
        role: "system",
        content: `${language.rule} Never switch language. Hotel recruiting assistant. ${instruction} If a fact is missing, say you do not know. Do not invent employers, years, or job titles for the candidate.`,
      },
      ...prior,
      { role: "user", content: `App language: ${language.name}. Reply only in ${language.name}.\n\nQuestion:\n${query}\n\nRecruiting pack:\n${pack}` },
    ]);
    if (answer) return { answer };
    return {
      answer: chatLocale === "de"
        ? "Die KI-Antwort ist gerade nicht verfügbar. Ich rate keine Lebenslauf-Daten."
        : chatLocale === "it"
          ? "La risposta IA non è disponibile. Non invento dati del CV."
          : "The language model is unavailable. I will not guess CV facts.",
    };
  } catch {
    return { error: "MODEL_FAILED" as const };
  }
}
