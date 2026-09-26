import "server-only";

import { randomUUID } from "node:crypto";
import { currentAccessUser } from "../auth/module-access";
import { prisma } from "../prisma";
import { manualsViewer } from "../manuals/access";
import { answerManualQuestion } from "../manuals/chat";
import { answerRecruitingQuestion } from "../recruiting/chat";
import { answerScheduleQuestion } from "../schedule/chat";
import { answerGeneralQuestion } from "./general-chat";
import { isAssistantKey, type AssistantKey } from "./assistants";

type Locale = "en" | "de" | "it";

const PENDING: Record<Locale, (text: string) => string> = {
  en: (text) => `(Not connected yet) I received: “${text}”. Manuals, Recruiting, and Optimize schedule use hotel data today.`,
  de: (text) => `(Noch nicht verbunden) Ich habe erhalten: „${text}“. Handbücher, Recruiting-Hilfe und Dienstplan nutzen heute Hoteldaten.`,
  it: (text) => `(Non ancora collegato) Ho ricevuto: “${text}”. Manuali, Aiuto recruiting e Ottimizza turni usano oggi i dati dell’hotel.`,
};

function localeOf(value: unknown): Locale {
  return value === "de" || value === "it" || value === "en" ? value : "en";
}

function asMessage(row: { role: string; content: string; createdAt: Date }) {
  return {
    role: row.role === "user" ? "user" as const : "assistant" as const,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

async function conversationFor(assistantKey: AssistantKey) {
  const user = await currentAccessUser();
  if (!user) return null;
  const existing = await prisma.aiConversation.findUnique({
    where: { hotelTenantId_userId_assistantKey: { hotelTenantId: user.hotel_tenant_id, userId: user.id, assistantKey } },
  });
  if (existing) return { user, conversation: existing };
  const conversation = await prisma.aiConversation.create({
    data: { id: randomUUID(), hotelTenantId: user.hotel_tenant_id, userId: user.id, assistantKey },
  });
  return { user, conversation };
}

export async function loadAssistantConversation(assistantKey: unknown) {
  if (!isAssistantKey(assistantKey)) return { error: "UNKNOWN_ASSISTANT" as const };
  const session = await conversationFor(assistantKey);
  if (!session) return { error: "UNAUTHENTICATED" as const };
  const messages = await prisma.aiConversationMessage.findMany({
    where: { conversationId: session.conversation.id },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return { conversationId: session.conversation.id, assistantKey, messages: messages.map(asMessage) };
}

async function produceReply(assistantKey: AssistantKey, message: string, history: { role: "user" | "assistant"; content: string }[], locale: Locale) {
  if (assistantKey === "manuals") {
    const actor = await manualsViewer();
    if (!actor) return { error: "UNAUTHENTICATED" as const };
    return answerManualQuestion(actor, message, history, locale);
  }
  if (assistantKey === "recruiting") {
    return answerRecruitingQuestion(message, history, locale);
  }
  if (assistantKey === "schedule") {
    return answerScheduleQuestion(message, history, locale);
  }
  if (assistantKey === "general") {
    return answerGeneralQuestion(message, history, locale);
  }
  return { answer: PENDING[locale](message.slice(0, 400)) };
}

export async function sendAssistantMessage(assistantKey: unknown, message: unknown, locale: unknown) {
  if (!isAssistantKey(assistantKey)) return { error: "UNKNOWN_ASSISTANT" as const, status: 400 };
  const text = typeof message === "string" ? message.trim().slice(0, 4000) : "";
  if (!text) return { error: "EMPTY" as const, status: 400 };
  const session = await conversationFor(assistantKey);
  if (!session) return { error: "UNAUTHENTICATED" as const, status: 401 };
  const prior = await prisma.aiConversationMessage.findMany({
    where: { conversationId: session.conversation.id },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { role: true, content: true },
  });
  const history = prior.reverse().flatMap((row): { role: "user" | "assistant"; content: string }[] => {
    if (row.role !== "user" && row.role !== "assistant") return [];
    return [{ role: row.role, content: row.content }];
  });
  await prisma.aiConversationMessage.create({
    data: { id: randomUUID(), conversationId: session.conversation.id, role: "user", content: text },
  });
  const result = await produceReply(assistantKey, text, history, localeOf(locale));
  const answer = "error" in result
    ? (localeOf(locale) === "de" ? "Die Antwort konnte nicht geladen werden." : localeOf(locale) === "it" ? "Impossibile caricare la risposta." : "The answer could not be loaded.")
    : result.answer;
  await prisma.aiConversationMessage.create({
    data: { id: randomUUID(), conversationId: session.conversation.id, role: "assistant", content: answer },
  });
  await prisma.aiConversation.update({ where: { id: session.conversation.id }, data: { updatedAt: new Date() } });
  return { conversationId: session.conversation.id, assistantKey, answer };
}
