import "server-only";

import { completeHotelChatJson } from "../ai/complete";
import { prisma } from "../prisma";

export type NameLocalePack = { en: string; de: string; it: string };

function asText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 180) : fallback;
}

export async function translateEntityName(hotelTenantId: string, locale: string, name: string): Promise<NameLocalePack> {
  const source = locale === "de" || locale === "it" ? locale : "en";
  const trimmed = name.trim().slice(0, 180);
  const base: NameLocalePack = { en: trimmed, de: trimmed, it: trimmed };
  if (!trimmed) return base;
  try {
    const json = await completeHotelChatJson(prisma, hotelTenantId, [
      {
        role: "system",
        content: `You translate hotel department and team names. Source language is ${source}. Return JSON only: {en,de,it}. Keep ${source} exactly as given. Translate into the other two languages. Keep hotel terms natural. Do not add extra keys.`,
      },
      { role: "user", content: JSON.stringify({ source, name: trimmed }) },
    ], { temperature: 0.1, timeoutMs: 25_000 });
    if (!json) return base;
    const pack = json.name && typeof json.name === "object" ? json.name as Record<string, unknown> : json;
    for (const lang of (["en", "de", "it"] as const).filter((item) => item !== source)) {
      base[lang] = asText(pack[lang], trimmed);
    }
    base[source] = trimmed;
    return base;
  } catch {
    return base;
  }
}
