import "server-only";

import { prisma } from "../prisma";
import type { ManualsActor } from "./access";

type ChatTurn = { role: "user" | "assistant"; content: string };
type ChatLocale = "en" | "de" | "it";

const STOP = new Set([
  "the", "and", "for", "you", "can", "give", "me", "doc", "document", "manual", "please", "from", "our", "your", "this", "that", "with", "what", "about",
  "eine", "einer", "einem", "einen", "der", "die", "das", "und", "mir", "uns", "bitte", "ueber", "über", "dokument", "handbuch",
  "una", "uno", "del", "della", "delle", "dei", "il", "lo", "la", "gli", "per", "dal", "documento", "manuale",
]);

const SUMMARY = /\b(summar(y|ise|ize)|overview|zusammenfassung|überblick|ueberblick|riassunt\w*)\b/i;

const LANGUAGE: Record<ChatLocale, { name: string; rule: string }> = {
  en: { name: "English", rule: "The app language is English. Write the entire answer in English." },
  de: { name: "German", rule: "The app language is German. Write the entire answer in German (Deutsch)." },
  it: { name: "Italian", rule: "The app language is Italian. Write the entire answer in Italian (Italiano)." },
};

function tokens(text: string) {
  return text.toLowerCase().normalize("NFKD").split(/[^\p{L}\p{N}]+/u).filter((item) => item.length > 2);
}

function queryTokens(question: string) {
  const all = tokens(question);
  const focused = all.filter((item) => !STOP.has(item));
  return focused.length ? focused : all;
}

function scoreChunk(title: string, content: string, queryTokens: string[]) {
  const haystack = `${title}\n${content}`.toLowerCase();
  const titleHay = title.toLowerCase();
  return queryTokens.reduce((total, token) => {
    let points = 0;
    if (titleHay.includes(token)) points += 8;
    if (haystack.includes(token)) points += 1;
    return total + points;
  }, 0);
}

function visibleDocuments(actor: ManualsActor) {
  if (actor.canManage) return { hotelTenantId: actor.hotel_tenant_id, indexStatus: "READY" };
  return {
    hotelTenantId: actor.hotel_tenant_id,
    indexStatus: "READY",
    OR: [{ departmentId: null }, ...(actor.departmentId ? [{ departmentId: actor.departmentId }] : [])],
  };
}

function parseLocale(value: unknown): ChatLocale {
  return value === "de" || value === "it" || value === "en" ? value : "en";
}

async function completeWithOpenAi(messages: { role: string; content: string }[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.1, messages }),
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

export async function answerManualQuestion(actor: ManualsActor, question: string, history: ChatTurn[], locale?: unknown) {
  const query = question.trim().slice(0, 2000);
  if (!query) return { error: "EMPTY" as const };
  const chatLocale = parseLocale(locale);
  const terms = queryTokens(query);
  const chunks = await prisma.manualChunk.findMany({
    where: { document: visibleDocuments(actor) },
    select: { content: true, chunkIndex: true, document: { select: { title: true } } },
    take: 600,
    orderBy: [{ chunkIndex: "asc" }],
  });
  if (!chunks.length) {
    return {
      answer: actor.canManage
        ? "No indexed manuals yet. Upload a document in Manuals and wait until it is processed."
        : "No indexed manuals are available for your department yet.",
    };
  }
  const namedTitles = [...new Set(chunks.map((chunk) => chunk.document.title))]
    .filter((title) => terms.some((term) => title.toLowerCase().includes(term)));
  const pool = namedTitles.length ? chunks.filter((chunk) => namedTitles.includes(chunk.document.title)) : chunks;
  const ranked = pool
    .map((chunk) => ({ ...chunk, score: terms.length ? scoreChunk(chunk.document.title, chunk.content, terms) : 1 }))
    .sort((left, right) => right.score - left.score || left.chunkIndex - right.chunkIndex);
  const selected = SUMMARY.test(query) && namedTitles.length
    ? [...pool].sort((left, right) => left.chunkIndex - right.chunkIndex).slice(0, 10)
    : (ranked.some((chunk) => chunk.score > 0) ? ranked.filter((chunk) => chunk.score > 0).slice(0, 8) : pool.slice(0, 6));
  const pack = selected.map((chunk, index) => `[${index + 1}] ${chunk.document.title}\n${chunk.content}`).join("\n\n").slice(0, 12000);
  const language = LANGUAGE[chatLocale];
  try {
    const answer = await completeWithOpenAi([
      {
        role: "system",
        content: `${language.rule} Never switch language, even if the question, handbook, or earlier messages are in another language. Translate facts from the excerpts into ${language.name} when needed. You are the hotel manuals assistant. Answer only from the handbook excerpts. If the answer is not in the excerpts, say you do not know. Do not invent procedures.`,
      },
      ...history.slice(-6).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) })),
      { role: "user", content: `App language: ${language.name}. Reply only in ${language.name}.\n\nQuestion:\n${query}\n\nHandbook excerpts:\n${pack}` },
    ]);
    if (answer) return { answer };
    return { answer: `I could not reach the language model. Matching handbook text:\n\n${pack.slice(0, 4000)}` };
  } catch {
    return { error: "MODEL_FAILED" as const };
  }
}
