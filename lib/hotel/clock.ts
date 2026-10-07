export const DEFAULT_HOTEL_TIME_ZONE = "Europe/Berlin";
const SHELL_USER_KEY = "qf-shell-user";

export function hotelTimeZone(value?: string | null) {
  const zone = value?.trim() || DEFAULT_HOTEL_TIME_ZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
    return zone;
  } catch {
    return DEFAULT_HOTEL_TIME_ZONE;
  }
}

function localeTag(locale: string) {
  return locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB";
}

export function hotelLocalIso(timeZone?: string | null, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: hotelTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function hotelDayStart(timeZone?: string | null, now = new Date()) {
  const zone = hotelTimeZone(timeZone);
  const [year, month, day] = hotelLocalIso(zone, now).split("-").map(Number);
  const guess = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  const offset = (date: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(value("year"), value("month") - 1, value("day"), value("hour") % 24, value("minute"), value("second")) - date.getTime();
  };
  const first = offset(guess);
  const utc = new Date(guess.getTime() - first);
  return first === offset(utc) ? utc : new Date(guess.getTime() - offset(utc));
}

export function hotelLocalHour(timeZone?: string | null, now = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: hotelTimeZone(timeZone),
    hour: "numeric",
    hourCycle: "h23",
  }).format(now));
}

export function formatHotelLongDate(value: Date, locale: string, timeZone?: string | null) {
  const formatted = new Intl.DateTimeFormat(localeTag(locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: hotelTimeZone(timeZone),
  }).format(value);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatHotelDate(value: Date, locale: string, timeZone?: string | null) {
  return value.toLocaleDateString(localeTag(locale), { timeZone: hotelTimeZone(timeZone) });
}

export function formatStoredDate(iso: string, locale: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(localeTag(locale), {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatHotelDateTime(value: Date, locale: string, timeZone?: string | null) {
  return value.toLocaleString(localeTag(locale), { dateStyle: "short", timeStyle: "short", timeZone: hotelTimeZone(timeZone) });
}

export function formatHotelTime(value: Date, locale: string, timeZone?: string | null) {
  return value.toLocaleTimeString(localeTag(locale), { hour: "2-digit", minute: "2-digit", timeZone: hotelTimeZone(timeZone) });
}

export function formatHotelMedium(value: Date, locale: string, timeZone?: string | null) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: hotelTimeZone(timeZone) }).format(value);
}

export function readHotelTimeZone() {
  if (typeof window === "undefined") return DEFAULT_HOTEL_TIME_ZONE;
  try {
    const raw = sessionStorage.getItem(SHELL_USER_KEY);
    const zone = raw ? (JSON.parse(raw) as { time_zone?: unknown }).time_zone : "";
    return hotelTimeZone(typeof zone === "string" ? zone : null);
  } catch {
    return DEFAULT_HOTEL_TIME_ZONE;
  }
}
