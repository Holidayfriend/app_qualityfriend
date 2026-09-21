import "server-only";

import { completeHotelChatJson } from "../ai/complete";
import { prisma } from "../prisma";

export type ChecklistLocalePack = {
  title: { en: string; de: string; it: string };
  desc: { en: string; de: string; it: string };
  items: { en: string; de: string; it: string }[];
};

function copyAll(title: string, desc: string, items: string[]): ChecklistLocalePack {
  return {
    title: { en: title, de: title, it: title },
    desc: { en: desc, de: desc, it: desc },
    items: items.map((item) => ({ en: item, de: item, it: item })),
  };
}

function asText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function translateChecklistFields(
  hotelTenantId: string,
  locale: string,
  input: { title: string; desc: string; items: string[] },
): Promise<ChecklistLocalePack> {
  const source = locale === "de" || locale === "it" ? locale : "en";
  const base = copyAll(input.title, input.desc, input.items);
  const others = (["en", "de", "it"] as const).filter((item) => item !== source);
  try {
    const json = await completeHotelChatJson(prisma, hotelTenantId, [
      {
        role: "system",
        content: `You translate hotel checklists. Source language is ${source}. Return JSON only with keys title, desc, items. title and desc are objects {en,de,it}. items is an array of {en,de,it} in the same order. Keep ${source} exactly as given. Translate into the other languages. Do not add extra keys.`,
      },
      { role: "user", content: JSON.stringify({ source, title: input.title, desc: input.desc, items: input.items }) },
    ], { temperature: 0.1, timeoutMs: 25_000 });
    if (!json) return base;
    const title = json.title && typeof json.title === "object" ? json.title as Record<string, unknown> : {};
    const desc = json.desc && typeof json.desc === "object" ? json.desc as Record<string, unknown> : {};
    const rows = Array.isArray(json.items) ? json.items : [];
    for (const lang of others) {
      base.title[lang] = asText(title[lang], input.title).slice(0, 180);
      base.desc[lang] = asText(desc[lang], input.desc);
    }
    base.title[source] = input.title;
    base.desc[source] = input.desc;
    base.items = input.items.map((item, index) => {
      const row = rows[index] && typeof rows[index] === "object" ? rows[index] as Record<string, unknown> : {};
      const pack = { en: item, de: item, it: item };
      for (const lang of others) pack[lang] = asText(row[lang], item).slice(0, 300);
      pack[source] = item.slice(0, 300);
      return pack;
    });
    return base;
  } catch {
    return base;
  }
}
