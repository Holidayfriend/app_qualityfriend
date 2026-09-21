import type { Locale } from "../i18n/dictionaries";

export function parseIsoDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function isoFromUtc(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function localTodayIso() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function addDaysIso(iso: string, days: number) {
  const date = parseIsoDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return isoFromUtc(date);
}

/** Monday of the ISO week that contains `iso` (YYYY-MM-DD). */
export function mondayOfIso(iso: string) {
  const date = parseIsoDate(iso);
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return isoFromUtc(date);
}

export function weekIsoDates(mondayIso: string) {
  return Array.from({ length: 7 }, (_, index) => addDaysIso(mondayIso, index));
}

function monthName(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(parseIsoDate(iso));
}

export function formatWeekRange(mondayIso: string, locale: Locale) {
  const endIso = addDaysIso(mondayIso, 6);
  const start = parseIsoDate(mondayIso);
  const end = parseIsoDate(endIso);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startMonth = monthName(mondayIso, locale);
  const endMonth = monthName(endIso, locale);
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const sameMonth = start.getUTCMonth() === end.getUTCMonth() && startYear === endYear;
  const sameYear = startYear === endYear;

  if (locale === "de") {
    if (sameMonth) return `${startDay}.–${endDay}. ${startMonth} ${endYear}`;
    if (sameYear) return `${startDay}. ${startMonth} – ${endDay}. ${endMonth} ${endYear}`;
    return `${startDay}. ${startMonth} ${startYear} – ${endDay}. ${endMonth} ${endYear}`;
  }
  if (sameMonth) return `${startDay}–${endDay} ${startMonth} ${endYear}`;
  if (sameYear) return `${startDay} ${startMonth} – ${endDay} ${endMonth} ${endYear}`;
  return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
}

export function formatDayHeader(iso: string, locale: Locale) {
  const date = parseIsoDate(iso);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" })
    .format(date)
    .replaceAll(".", "")
    .replace(/,$/, "")
    .trim();
  const label = weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : weekday;
  return `${label} ${date.getUTCDate()}`;
}
