import "server-only";

import { completeHotelChatJson } from "../ai/complete";
import { prisma } from "../prisma";

export type ShiftTemplateLocalePack = {
  name: { en: string; de: string; it: string };
  note: { en: string; de: string; it: string };
};

function copyAll(name: string, note: string): ShiftTemplateLocalePack {
  return {
    name: { en: name, de: name, it: name },
    note: { en: note, de: note, it: note },
  };
}

function asText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function translateShiftTemplateFields(
  hotelTenantId: string,
  locale: string,
  input: { name: string; note: string },
): Promise<ShiftTemplateLocalePack> {
  const source = locale === "de" || locale === "it" ? locale : "en";
  const base = copyAll(input.name, input.note);
  const others = (["en", "de", "it"] as const).filter((item) => item !== source);
  if (!input.note.trim() && !input.name.trim()) return base;
  try {
    const json = await completeHotelChatJson(prisma, hotelTenantId, [
      {
        role: "system",
        content: `You translate hotel shift text. Source language is ${source}. Return JSON only with keys name and note. Each is an object {en,de,it}. Keep ${source} exactly as given. Translate into the other languages. Do not add extra keys.`,
      },
      { role: "user", content: JSON.stringify({ source, name: input.name, note: input.note }) },
    ], { temperature: 0.1, timeoutMs: 25_000 });
    if (!json) return base;
    const name = json.name && typeof json.name === "object" ? json.name as Record<string, unknown> : {};
    const note = json.note && typeof json.note === "object" ? json.note as Record<string, unknown> : {};
    for (const lang of others) {
      base.name[lang] = asText(name[lang], input.name).slice(0, 180);
      base.note[lang] = asText(note[lang], input.note);
    }
    base.name[source] = input.name;
    base.note[source] = input.note;
    return base;
  } catch {
    return base;
  }
}

export async function translateShiftNote(hotelTenantId: string, locale: string, note: string) {
  const pack = await translateShiftTemplateFields(hotelTenantId, locale, { name: "", note });
  return pack.note;
}
