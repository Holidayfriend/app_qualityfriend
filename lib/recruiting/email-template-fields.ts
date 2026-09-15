import type { Locale } from "../i18n/dictionaries";
import { emailTemplatesSeed, type EmailCat, type EmailTemplates } from "./preview-data";

export const EMAIL_CATS: EmailCat[] = ["received", "offer", "reject"];
export const EMAIL_LOCALES: Locale[] = ["de", "en", "it"];

const categoryMap = { received: "RECEIVED", offer: "OFFER", reject: "REJECT" } as const;
const categoryFromDb = { RECEIVED: "received", OFFER: "offer", REJECT: "reject" } as const;

export type EmailAutoFlags = Record<EmailCat, boolean>;

export type EmailTemplateRow = {
  category: "RECEIVED" | "OFFER" | "REJECT";
  locale: Locale;
  subject: string;
  body: string;
  autoSend: boolean;
};

export function defaultEmailAutoFlags(): EmailAutoFlags {
  return { received: true, offer: true, reject: true };
}

export function seedEmailTemplateRows(): EmailTemplateRow[] {
  return EMAIL_CATS.flatMap((cat) =>
    EMAIL_LOCALES.map((locale) => ({
      category: categoryMap[cat],
      locale,
      subject: emailTemplatesSeed[cat][locale].subject,
      body: emailTemplatesSeed[cat][locale].body,
      autoSend: true,
    })),
  );
}

export function emptyEmailTemplates(): EmailTemplates {
  return {
    received: { de: { subject: "", body: "" }, en: { subject: "", body: "" }, it: { subject: "", body: "" } },
    offer: { de: { subject: "", body: "" }, en: { subject: "", body: "" }, it: { subject: "", body: "" } },
    reject: { de: { subject: "", body: "" }, en: { subject: "", body: "" }, it: { subject: "", body: "" } },
  };
}

export function toPublicEmailTemplates(rows: Array<{ category: keyof typeof categoryFromDb; locale: string; subject: string; body: string }>): EmailTemplates {
  const templates = JSON.parse(JSON.stringify(emailTemplatesSeed)) as EmailTemplates;
  for (const row of rows) {
    const cat = categoryFromDb[row.category];
    if (!cat || (row.locale !== "de" && row.locale !== "en" && row.locale !== "it")) continue;
    templates[cat][row.locale] = { subject: row.subject, body: row.body };
  }
  return templates;
}

export function toPublicEmailAuto(rows: Array<{ category: keyof typeof categoryFromDb; autoSend: boolean }>): EmailAutoFlags {
  const auto = defaultEmailAutoFlags();
  for (const row of rows) {
    const cat = categoryFromDb[row.category];
    if (!cat) continue;
    auto[cat] = row.autoSend;
  }
  return auto;
}

export function parseEmailTemplatesInput(body: unknown): { templates: EmailTemplates; auto: EmailAutoFlags } | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as { templates?: unknown; auto?: unknown };
  const data = payload.templates ?? body;
  if (!data || typeof data !== "object") return null;
  const nested = data as Record<string, Record<string, { subject?: unknown; body?: unknown }>>;
  const templates = emptyEmailTemplates();
  for (const cat of EMAIL_CATS) {
    for (const locale of EMAIL_LOCALES) {
      const item = nested[cat]?.[locale];
      if (!item || typeof item.subject !== "string" || typeof item.body !== "string") return null;
      const subject = item.subject.trim();
      const text = item.body.trim();
      if (subject.length > 255 || text.length > 20000) return null;
      templates[cat][locale] = { subject, body: text };
    }
  }
  const auto = defaultEmailAutoFlags();
  if (payload.auto && typeof payload.auto === "object") {
    const flags = payload.auto as Record<string, unknown>;
    for (const cat of EMAIL_CATS) {
      if (typeof flags[cat] !== "boolean") return null;
      auto[cat] = flags[cat];
    }
  }
  return { templates, auto };
}

export function flattenEmailTemplates(templates: EmailTemplates, auto: EmailAutoFlags): EmailTemplateRow[] {
  return EMAIL_CATS.flatMap((cat) =>
    EMAIL_LOCALES.map((locale) => ({
      category: categoryMap[cat],
      locale,
      subject: templates[cat][locale].subject,
      body: templates[cat][locale].body,
      autoSend: auto[cat],
    })),
  );
}

export function emailTemplatesAuditSnapshot(templates: EmailTemplates, auto: EmailAutoFlags) {
  return {
    en: "Email templates",
    de: "E-Mail-Vorlagen",
    it: "Modelli e-mail",
    title: "Email templates",
    templates,
    auto,
  };
}
