export const descriptionFields = { en: "descriptionEn", de: "descriptionDe", it: "descriptionIt" } as const;
export type ExtraLocale = keyof typeof descriptionFields;

export function isExtraLocale(value: unknown): value is ExtraLocale {
  return value === "en" || value === "de" || value === "it";
}

export function extraJobInput(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { locale, description, minutes } = body as Record<string, unknown>;
  if (!isExtraLocale(locale) || typeof description !== "string" || !description.trim() || description.trim().length > 5000 || typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 0 || minutes > 2147483647) return null;
  // Write exactly one translation, including when creating a job.
  return { locale, data: { [descriptionFields[locale]]: description.trim(), minutes } };
}

export function extraJobSnapshot(job: { descriptionEn: string; descriptionDe: string; descriptionIt: string; minutes: number }) {
  return { en: job.descriptionEn, de: job.descriptionDe, it: job.descriptionIt, minutes: job.minutes };
}
