import "server-only";

import { completeHotelChatJson } from "../ai/complete";
import { prisma } from "../prisma";
import { REPAIR_AREA_KEYS, type RepairAreaKey } from "./demo-data";

const AREA: Record<RepairAreaKey, { en: string; de: string; it: string }> = {
  "hall-2": { en: "2nd floor hallway", de: "Flur Etage 2", it: "Corridoio 2° piano" },
  boiler: { en: "Boiler room", de: "Heizraum", it: "Locale caldaia" },
  basement: { en: "Basement", de: "Keller", it: "Cantina" },
  garden: { en: "Garden / outdoor", de: "Garten / Außenbereich", it: "Giardino / esterno" },
  restaurant: { en: "Restaurant", de: "Restaurant", it: "Ristorante" },
  spa: { en: "SeaSpa", de: "SeaSpa", it: "SeaSpa" },
};

export type LocalePack = {
  title: { en: string; de: string; it: string };
  description: { en: string; de: string; it: string };
  location: { en: string; de: string; it: string };
  tags: { en: string[]; de: string[]; it: string[] };
};

function copyAll(title: string, description: string, location: string, tags: string[]): LocalePack {
  return {
    title: { en: title, de: title, it: title },
    description: { en: description, de: description, it: description },
    location: { en: location, de: location, it: location },
    tags: { en: tags, de: tags, it: tags },
  };
}

function knownLocation(locationKey: string) {
  if (/^\d+[a-z]?$/i.test(locationKey)) {
    return { en: `Room ${locationKey}`, de: `Zimmer ${locationKey}`, it: `Camera ${locationKey}` };
  }
  if (REPAIR_AREA_KEYS.includes(locationKey as RepairAreaKey)) return AREA[locationKey as RepairAreaKey];
  return null;
}

function asText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asTags(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : fallback;
}

export async function translateRepairFields(
  hotelTenantId: string,
  locale: string,
  input: { title: string; description: string; locationKey: string; locationLabel: string; tags: string[] },
): Promise<LocalePack> {
  const source = locale === "de" || locale === "it" ? locale : "en";
  const known = knownLocation(input.locationKey);
  const base = copyAll(input.title, input.description, known?.[source] || input.locationLabel || input.locationKey, input.tags);
  if (known) base.location = known;
  const others = (["en", "de", "it"] as const).filter((item) => item !== source);
  try {
    const json = await completeHotelChatJson(prisma, hotelTenantId, [
      {
        role: "system",
        content: `You translate hotel maintenance tickets. Source language is ${source}. Return JSON only with keys title, description, location, tags. Each of title/description/location is an object {en,de,it}. tags is {en:[],de:[],it:[]}. Keep ${source} exactly as given. Translate into the other languages. Keep room numbers unchanged. Do not add extra keys.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          source,
          title: input.title,
          description: input.description,
          location: base.location[source],
          tags: input.tags,
        }),
      },
    ], { temperature: 0.1, timeoutMs: 25_000 });
    if (!json) return base;
    const title = json.title && typeof json.title === "object" ? json.title as Record<string, unknown> : {};
    const description = json.description && typeof json.description === "object" ? json.description as Record<string, unknown> : {};
    const location = json.location && typeof json.location === "object" ? json.location as Record<string, unknown> : {};
    const tags = json.tags && typeof json.tags === "object" ? json.tags as Record<string, unknown> : {};
    for (const lang of others) {
      base.title[lang] = asText(title[lang], input.title).slice(0, 180);
      base.description[lang] = asText(description[lang], input.description);
      if (!known) base.location[lang] = asText(location[lang], base.location[source]).slice(0, 180);
      base.tags[lang] = asTags(tags[lang], input.tags);
    }
    base.title[source] = input.title;
    base.description[source] = input.description;
    base.location[source] = known?.[source] || input.locationLabel || input.locationKey;
    base.tags[source] = input.tags;
    return base;
  } catch {
    return base;
  }
}
