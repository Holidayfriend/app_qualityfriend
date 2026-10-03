export const descriptionFields = { en: "descriptionEn", de: "descriptionDe", it: "descriptionIt" } as const;
export type ExtraLocale = keyof typeof descriptionFields;

export function isExtraLocale(value: unknown): value is ExtraLocale {
  return value === "en" || value === "de" || value === "it";
}

export function extraJobInput(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const { locale, description, minutes } = body as Record<string, unknown>;
  if (!isExtraLocale(locale) || typeof description !== "string" || !description.trim() || description.trim().length > 5000 || typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 0 || minutes > 2147483647) return null;
  // Validate only the submitted language; translations are generated after validation.
  return { locale, data: { [descriptionFields[locale]]: description.trim(), minutes } };
}

export function extraJobSnapshot(job: { descriptionEn: string; descriptionDe: string; descriptionIt: string; minutes: number }) {
  return { en: job.descriptionEn, de: job.descriptionDe, it: job.descriptionIt, minutes: job.minutes };
}

export function extraJobDescription(job: { descriptionEn: string; descriptionDe: string; descriptionIt: string }, locale: ExtraLocale) {
  return [job[descriptionFields[locale]], job.descriptionEn, job.descriptionDe, job.descriptionIt].map(text => text.trim()).find(Boolean) ?? "";
}

export async function localizeExtraJobInput(
  input: NonNullable<ReturnType<typeof extraJobInput>>,
  translate: (locale: ExtraLocale, description: string) => Promise<Record<ExtraLocale, string>>,
) {
  const description = String(input.data[descriptionFields[input.locale]]);
  const pack = await translate(input.locale, description);
  // The user's source text remains authoritative even if the translator changes it.
  pack[input.locale] = description;
  return { minutes: input.data.minutes, descriptionEn: pack.en, descriptionDe: pack.de, descriptionIt: pack.it };
}
