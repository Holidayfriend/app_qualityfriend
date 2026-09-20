import "server-only";

import { completeHotelChatJson } from "../ai/complete";
import { prisma } from "../prisma";

export type TaskLocalePack = {
  title: { en: string; de: string; it: string };
  note: { en: string; de: string; it: string };
};

function copyAll(title: string, note: string): TaskLocalePack {
  return {
    title: { en: title, de: title, it: title },
    note: { en: note, de: note, it: note },
  };
}

function asText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function translateTaskFields(
  hotelTenantId: string,
  locale: string,
  input: { title: string; note: string },
): Promise<TaskLocalePack> {
  const source = locale === "de" || locale === "it" ? locale : "en";
  const base = copyAll(input.title, input.note);
  const others = (["en", "de", "it"] as const).filter((item) => item !== source);
  try {
    const json = await completeHotelChatJson(prisma, hotelTenantId, [
      {
        role: "system",
        content: `You translate hotel tasks. Source language is ${source}. Return JSON only with keys title and note. Each is an object {en,de,it}. Keep ${source} exactly as given. Translate into the other languages. Do not add extra keys.`,
      },
      { role: "user", content: JSON.stringify({ source, title: input.title, note: input.note }) },
    ], { temperature: 0.1, timeoutMs: 25_000 });
    if (!json) return base;
    const title = json.title && typeof json.title === "object" ? json.title as Record<string, unknown> : {};
    const note = json.note && typeof json.note === "object" ? json.note as Record<string, unknown> : {};
    for (const lang of others) {
      base.title[lang] = asText(title[lang], input.title).slice(0, 180);
      base.note[lang] = asText(note[lang], input.note);
    }
    base.title[source] = input.title;
    base.note[source] = input.note;
    return base;
  } catch {
    return base;
  }
}
