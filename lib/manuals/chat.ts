import "server-only";

import { prisma } from "../prisma";
import type { ManualsActor } from "./access";

type ChatTurn = { role: "user" | "assistant"; content: string };

function tokens(text: string) {
  return text.toLowerCase().normalize("NFKD").split(/[^\p{L}\p{N}]+/u).filter((item) => item.length > 2);
}

function scoreChunk(content: string, queryTokens: string[]) {
  const haystack = content.toLowerCase();
  return queryTokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
}

function visibleDocuments(actor: ManualsActor) {
  if (actor.canManage) return { hotelTenantId: actor.hotel_tenant_id, indexStatus: "READY" };
  return {
    hotelTenantId: actor.hotel_tenant_id,
    indexStatus: "READY",
    OR: [{ departmentId: null }, ...(actor.departmentId ? [{ departmentId: actor.departmentId }] : [])],
  };
}

async function completeWithOpenAi(messages: { role: string; content: string }[]) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.2, messages }),
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

export async function answerManualQuestion(actor: ManualsActor, question: string, history: ChatTurn[]) {
  const query = question.trim().slice(0, 2000);
  if (!query) return { error: "EMPTY" as const };
  const queryTokens = tokens(query);
  const chunks = await prisma.manualChunk.findMany({
    where: { document: visibleDocuments(actor) },
    select: { content: true, document: { select: { title: true } } },
    take: 400,
  });
  if (!chunks.length) {
    return {
      answer: actor.canManage
        ? "No indexed manuals yet. Upload a document in Manuals and wait until it is processed."
        : "No indexed manuals are available for your department yet.",
    };
  }
  const ranked = chunks
    .map((chunk) => ({ ...chunk, score: queryTokens.length ? scoreChunk(chunk.content, queryTokens) : 1 }))
    .filter((chunk) => chunk.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);
  const selected = ranked.length ? ranked : chunks.slice(0, 4).map((chunk) => ({ ...chunk, score: 0 }));
  const pack = selected.map((chunk, index) => `[${index + 1}] ${chunk.document.title}\n${chunk.content}`).join("\n\n").slice(0, 12000);
  try {
    const answer = await completeWithOpenAi([
      {
        role: "system",
        content: "You are the hotel manuals assistant. Answer only from the handbook excerpts. If the answer is not in the excerpts, say you do not know. Reply in the user's language. Do not invent procedures.",
      },
      ...history.slice(-8).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) })),
      { role: "user", content: `Question:\n${query}\n\nHandbook excerpts:\n${pack}` },
    ]);
    if (answer) return { answer };
    return { answer: `I could not reach the language model. Matching handbook text:\n\n${pack.slice(0, 4000)}` };
  } catch {
    return { error: "MODEL_FAILED" as const };
  }
}
