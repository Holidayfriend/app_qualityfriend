import "server-only";

import { completeHotelChatJson } from "../ai/complete";
import { prisma } from "../prisma";
import { sanitizeJobHtml } from "../recruiting/job-fields";

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

function cleanHtml(value: string) {
  return sanitizeJobHtml(value).trim().slice(0, 20000);
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
  const sourceDescription = cleanHtml(input.description);
  const base = copyAll(input.title, sourceDescription, input.tags);
  const others = (["en", "de", "it"] as const).filter((item) => item !== source);
  try {
    const json = await completeHotelChatJson(prisma, hotelTenantId, [
      {
        role: "system",
        content: `You translate hotel shift handovers. Source language is ${source}. Return JSON only with keys title, description, tags. title/description are objects {en,de,it}. tags is {en:[],de:[],it:[]}. Keep ${source} exactly as given. Translate into the other languages. Preserve HTML tags, links and formatting in description; translate only visible text. Do not add extra keys.`,
      },
      { role: "user", content: JSON.stringify({ source, title: input.title, description: sourceDescription, tags: input.tags }) },
    ], { temperature: 0.1, timeoutMs: 25_000 });
    if (!json) return base;
    const title = json.title && typeof json.title === "object" ? json.title as Record<string, unknown> : {};
    const translatedDescription = json.description && typeof json.description === "object" ? json.description as Record<string, unknown> : {};
    const tags = json.tags && typeof json.tags === "object" ? json.tags as Record<string, unknown> : {};
    for (const lang of others) {
      base.title[lang] = asText(title[lang], input.title).slice(0, 180);
      base.description[lang] = cleanHtml(asText(translatedDescription[lang], sourceDescription));
      base.tags[lang] = asTags(tags[lang], input.tags);
    }
    base.title[source] = input.title;
    base.description[source] = sourceDescription;
    base.tags[source] = input.tags;
    return base;
  } catch {
    return base;
  }
}
