import "server-only";

import { completeHotelChatJson } from "../ai/complete";
import { prisma } from "../prisma";

export type LocalePack = {
  title: { en: string; de: string; it: string };
  description: { en: string; de: string; it: string };
  tags: { en: string[]; de: string[]; it: string[] };
};

function copyAll(title: string, description: string, tags: string[]): LocalePack {
  return {
    title: { en: title, de: title, it: title },
    description: { en: description, de: description, it: description },
    tags: { en: tags, de: tags, it: tags },
  };
}

function asText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asTags(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : fallback;
}

export async function translateHandoverFields(
  hotelTenantId: string,
  locale: string,
  input: { title: string; description: string; tags: string[] },
): Promise<LocalePack> {
  const source = locale === "de" || locale === "it" ? locale : "en";
  const base = copyAll(input.title, input.description, input.tags);
  const others = (["en", "de", "it"] as const).filter((item) => item !== source);
  try {
    const json = await completeHotelChatJson(prisma, hotelTenantId, [
      {
        role: "system",
        content: `You translate hotel shift handovers. Source language is ${source}. Return JSON only with keys title, description, tags. title/description are objects {en,de,it}. tags is {en:[],de:[],it:[]}. Keep ${source} exactly as given. Translate into the other languages. Do not add extra keys.`,
      },
      { role: "user", content: JSON.stringify({ source, title: input.title, description: input.description, tags: input.tags }) },
    ], { temperature: 0.1, timeoutMs: 25_000 });
    if (!json) return base;
    const title = json.title && typeof json.title === "object" ? json.title as Record<string, unknown> : {};
    const description = json.description && typeof json.description === "object" ? json.description as Record<string, unknown> : {};
    const tags = json.tags && typeof json.tags === "object" ? json.tags as Record<string, unknown> : {};
    for (const lang of others) {
      base.title[lang] = asText(title[lang], input.title).slice(0, 180);
      base.description[lang] = asText(description[lang], input.description);
      base.tags[lang] = asTags(tags[lang], input.tags);
    }
    base.title[source] = input.title;
    base.description[source] = input.description;
    base.tags[source] = input.tags;
    return base;
  } catch {
    return base;
  }
}
