import "server-only";

import { completeHotelChatJson } from "../ai/complete";
import { prisma } from "../prisma";

type Lang = "en" | "de" | "it";
type HtmlPack = Record<Lang, string | null>;

export type HotelPolicyPack = {
  dataProtection: HtmlPack;
  privacyPolicy: HtmlPack;
};

function sourceLang(locale: string): Lang {
  return locale === "de" || locale === "it" ? locale : "en";
}

function sanitizePolicyHtml(raw: string) {
  const clean = raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?(?:iframe|object|embed|link|meta|style)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, "")
    .trim();
  if (!clean || clean.length > 200_000) return null;
  const plain = clean.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
  return plain ? clean : null;
}

function pack(html: string): HtmlPack {
  const value = sanitizePolicyHtml(html);
  return { en: value, de: value, it: value };
}

function asHtml(value: unknown) {
  return typeof value === "string" ? value : "";
}

export async function translateHotelPolicies(
  hotelTenantId: string,
  locale: string,
  input: { dataProtection: string; privacyPolicy: string },
): Promise<HotelPolicyPack> {
  const source = sourceLang(locale);
  const base: HotelPolicyPack = {
    dataProtection: pack(input.dataProtection),
    privacyPolicy: pack(input.privacyPolicy),
  };
  const others = (["en", "de", "it"] as const).filter((lang) => lang !== source);
  if (!base.dataProtection[source] && !base.privacyPolicy[source]) return base;
  try {
    const json = await completeHotelChatJson(prisma, hotelTenantId, [
      {
        role: "system",
        content: `You translate hotel legal HTML. Source language is ${source}. Return JSON only with keys dataProtection and privacyPolicy. Each is an object {en,de,it} of HTML strings. Keep ${source} exactly as given. Translate the visible text into the other two languages. Preserve tags, links, lists, and structure. Do not add scripts or extra keys.`,
      },
      { role: "user", content: JSON.stringify({ source, dataProtection: input.dataProtection, privacyPolicy: input.privacyPolicy }) },
    ], { temperature: 0.1, timeoutMs: 45_000 });
    if (!json) return base;
    const dataProtection = json.dataProtection && typeof json.dataProtection === "object" ? json.dataProtection as Record<string, unknown> : {};
    const privacyPolicy = json.privacyPolicy && typeof json.privacyPolicy === "object" ? json.privacyPolicy as Record<string, unknown> : {};
    if (base.dataProtection[source]) {
      for (const lang of others) {
        const next = sanitizePolicyHtml(asHtml(dataProtection[lang]));
        if (next) base.dataProtection[lang] = next;
      }
      base.dataProtection[source] = sanitizePolicyHtml(input.dataProtection);
    } else base.dataProtection = { en: null, de: null, it: null };
    if (base.privacyPolicy[source]) {
      for (const lang of others) {
        const next = sanitizePolicyHtml(asHtml(privacyPolicy[lang]));
        if (next) base.privacyPolicy[lang] = next;
      }
      base.privacyPolicy[source] = sanitizePolicyHtml(input.privacyPolicy);
    } else base.privacyPolicy = { en: null, de: null, it: null };
    return base;
  } catch {
    return base;
  }
}
