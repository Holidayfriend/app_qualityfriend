import type { PrismaClient } from "../../app/generated/prisma/client";
import { completeHotelChatJson } from "./complete";
import { collectOpsFacts } from "./ops-facts";
import { bodiesForPlace, HANDOVER_LABELS, priorityTasks, type BriefingBodies, type OpsFacts } from "./ops-briefing-text";
import { saveHotelAiRecommendation } from "./recommendation-store";

export type OpsPlace = "DASHBOARD" | "HANDOVERS" | "TASKS";

function keepsFacts(text: string, facts: OpsFacts, place: OpsPlace, lang: "en" | "de" | "it") {
  const value = text.trim();
  if (!value) return false;
  if (place === "HANDOVERS") {
    const labels = HANDOVER_LABELS[lang];
    if (!value.includes(labels.focus) || !value.includes(labels.open) || !value.includes(labels.staff)) return false;
  }
  if (place !== "TASKS" && !value.includes(String(facts.arrivals))) return false;
  const room = facts.expressRooms[0]?.number;
  if (room && !value.includes(room)) return false;
  const top = priorityTasks(facts)[0];
  if (place === "TASKS" && top && !value.includes(top.title)) return false;
  if (place === "TASKS" && !top && !value.includes("0") && !/keine offenen|nessun compito|no open tasks/i.test(value)) return false;
  return true;
}

function accepted(parsed: Record<string, unknown> | null, facts: OpsFacts, place: OpsPlace): BriefingBodies | null {
  if (!parsed) return null;
  const bodyEn = typeof parsed.bodyEn === "string" ? parsed.bodyEn.trim() : "";
  const bodyDe = typeof parsed.bodyDe === "string" ? parsed.bodyDe.trim() : "";
  const bodyIt = typeof parsed.bodyIt === "string" ? parsed.bodyIt.trim() : "";
  if (!keepsFacts(bodyEn, facts, place, "en") || !keepsFacts(bodyDe, facts, place, "de") || !keepsFacts(bodyIt, facts, place, "it")) return null;
  return { bodyEn: bodyEn.slice(0, 1400), bodyDe: bodyDe.slice(0, 1400), bodyIt: bodyIt.slice(0, 1400) };
}

function instruction(place: OpsPlace) {
  if (place === "DASHBOARD") return "Rewrite as 2 or 3 short sentences for the hotel dashboard. Keep arrivals, departures, express rooms, deadlines, and who is off.";
  if (place === "HANDOVERS") return "Keep the three labeled lines exactly (Today's focus / Open items / Staff note, and the German and Italian labels). You may tighten the words after each label. Keep the blank line between sections.";
  return "Rewrite as 2 short sentences. Name the priority tasks first, in the same order, then housekeeping and who is off.";
}

export async function generateOpsBriefing(prisma: PrismaClient, hotelTenantId: string, place: OpsPlace, facts: OpsFacts) {
  const fallback = bodiesForPlace(place, facts);
  try {
    const parsed = await completeHotelChatJson(prisma, hotelTenantId, [
      {
        role: "system",
        content: "You rewrite an internal hotel operations note for managers. Keep every number, room number, person name, and task title. Do not invent guests, reviews, restaurant bookings, rooms, or tasks. Return JSON only.",
      },
      {
        role: "user",
        content: `${instruction(place)}\nReturn JSON: {"bodyEn":"...","bodyDe":"...","bodyIt":"..."}\n\nEnglish:\n${fallback.bodyEn}\n\nGerman:\n${fallback.bodyDe}\n\nItalian:\n${fallback.bodyIt}`,
      },
    ]);
    const bodies = accepted(parsed, facts, place) ?? fallback;
    await saveHotelAiRecommendation(prisma, hotelTenantId, place, bodies);
    return { hotelTenantId, place, usedModel: bodies !== fallback };
  } catch {
    await saveHotelAiRecommendation(prisma, hotelTenantId, place, fallback);
    return { hotelTenantId, place, usedModel: false };
  }
}

export { collectOpsFacts };
