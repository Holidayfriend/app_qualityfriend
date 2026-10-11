import { locales, sanitizeJobHtml, type JobLocale } from "./job-fields";

export type JobTranslationFields = { title: string; notes: string; description: string };

type JobTranslationPatch = {
  title: string;
  titleDe: string;
  titleIt: string;
  notes: string;
  notesDe: string;
  notesIt: string;
  description: string;
  descriptionDe: string;
  descriptionIt: string;
};

export function jobTranslationFallbackPatch(locale: string, fields: JobTranslationFields, fillAllLocales: true): JobTranslationPatch;
export function jobTranslationFallbackPatch(locale: string, fields: JobTranslationFields, fillAllLocales?: false): Partial<JobTranslationPatch>;
export function jobTranslationFallbackPatch(locale: string, fields: JobTranslationFields, fillAllLocales = false): Partial<JobTranslationPatch> {
  if (fillAllLocales) {
    return {
      title: fields.title,
      titleDe: fields.title,
      titleIt: fields.title,
      notes: fields.notes,
      notesDe: fields.notes,
      notesIt: fields.notes,
      description: fields.description,
      descriptionDe: fields.description,
      descriptionIt: fields.description,
    };
  }
  if (locale === "de") return { titleDe: fields.title, notesDe: fields.notes, descriptionDe: fields.description };
  if (locale === "it") return { titleIt: fields.title, notesIt: fields.notes, descriptionIt: fields.description };
  return { title: fields.title, notes: fields.notes, description: fields.description };
}

export function jobTranslationPatch(source: JobLocale, fields: JobTranslationFields, result: Record<string, unknown>) {
  const pack = {} as Record<JobLocale, JobTranslationFields>;
  for (const lang of locales) {
    if (lang === source) {
      pack[lang] = { ...fields };
      continue;
    }
    const raw = result[lang];
    if (!raw || typeof raw !== "object") throw new Error("Incomplete job translation");
    const row = raw as Record<string, unknown>;
    const translated = {} as JobTranslationFields;
    for (const key of ["title", "notes", "description"] as const) {
      if (!fields[key].trim()) {
        translated[key] = "";
        continue;
      }
      const value = row[key];
      if (typeof value !== "string" || !value.trim()) throw new Error("Incomplete job translation");
      if (key === "title" && value.trim().length > 180) throw new Error("Translated title too long");
      if (key === "notes" && value.trim().length > 4000) throw new Error("Translated benefits too long");
      translated[key] = key === "description" ? sanitizeJobHtml(value.trim()) : value.trim();
      if (!translated[key].trim()) throw new Error("Empty job translation");
    }
    pack[lang] = translated;
  }
  return {
    title: pack.en.title, titleDe: pack.de.title, titleIt: pack.it.title,
    notes: pack.en.notes, notesDe: pack.de.notes, notesIt: pack.it.notes,
    description: pack.en.description, descriptionDe: pack.de.description, descriptionIt: pack.it.description,
  };
}
