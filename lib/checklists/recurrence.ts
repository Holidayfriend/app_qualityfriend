const WEEKDAYS = ["su", "mo", "tu", "we", "th", "fr", "sa"] as const;

export function isoDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

export function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function hotelTodayIso(timeZone?: string | null) {
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch {
      /* invalid IANA zone */
    }
  }
  return new Date().toISOString().slice(0, 10);
}

export function weekdayOf(iso: string) {
  const date = parseIsoDate(iso);
  if (!date) return "";
  return WEEKDAYS[date.getUTCDay()];
}

export function isDueOn(input: {
  dueType: "ONCE" | "RECURRING";
  recurrence: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  weekdays: string[];
  startAt: Date | null;
  endAt: Date | null;
  dueAt: Date | null;
}, dayIso: string) {
  if (input.startAt && isoDate(input.startAt) > dayIso) return false;
  if (input.endAt && isoDate(input.endAt) < dayIso) return false;
  if (input.dueType === "ONCE") return isoDate(input.dueAt) === dayIso;
  const anchor = isoDate(input.startAt) || isoDate(input.dueAt) || dayIso;
  if (input.recurrence === "DAILY") return true;
  if (input.recurrence === "WEEKLY") {
    const days = input.weekdays.length ? input.weekdays : [...WEEKDAYS];
    return days.includes(weekdayOf(dayIso));
  }
  const day = parseIsoDate(dayIso);
  const start = parseIsoDate(anchor);
  if (!day || !start) return false;
  if (input.recurrence === "MONTHLY") return day.getUTCDate() === start.getUTCDate();
  if (input.recurrence === "QUARTERLY") {
    const months = (day.getUTCFullYear() - start.getUTCFullYear()) * 12 + (day.getUTCMonth() - start.getUTCMonth());
    return months >= 0 && months % 3 === 0 && day.getUTCDate() === start.getUTCDate();
  }
  if (input.recurrence === "YEARLY") return day.getUTCMonth() === start.getUTCMonth() && day.getUTCDate() === start.getUTCDate();
  return false;
}

export function nextDueIso(input: {
  dueType: "ONCE" | "RECURRING";
  recurrence: "ONCE" | "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  weekdays: string[];
  startAt: Date | null;
  endAt: Date | null;
  dueAt: Date | null;
}, fromIso: string) {
  if (input.dueType === "ONCE") return isoDate(input.dueAt);
  for (let i = 0; i < 400; i += 1) {
    const date = parseIsoDate(fromIso);
    if (!date) return "";
    date.setUTCDate(date.getUTCDate() + i);
    const iso = isoDate(date);
    if (isDueOn(input, iso)) return iso;
  }
  return "";
}
