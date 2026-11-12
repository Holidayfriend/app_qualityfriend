import { addDaysIso } from "./week";

export const DEFAULT_BREAK_MINS = 30;
export const LONG_SHIFT_MINUTES = 12 * 60;

function clockMins(value: string) {
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)/);
  if (!match) return null;
  const hours = Number(match[1]);
  if (hours > 23) return null;
  return hours * 60 + Number(match[2]);
}

export function spanMinutes(start: string, end: string) {
  const from = clockMins(start);
  const to = clockMins(end);
  if (from == null || to == null) return null;
  let mins = to - from;
  if (mins <= 0) mins += 24 * 60;
  return mins;
}

export function breakMinutesForSave(value: unknown, work: boolean) {
  if (!work) return 0;
  if (value === "" || value == null) return DEFAULT_BREAK_MINS;
  const amount = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(amount)) return null;
  const mins = Math.round(amount);
  if (mins < 0 || mins > 720) return null;
  return mins;
}

export type ShiftWarning = { code: "long" | "splitLong" | "overlap"; hours?: number };

function range(start: string, end: string): [number, number] | null {
  const from = clockMins(start);
  const span = spanMinutes(start, end);
  if (from == null || span == null) return null;
  return [from, from + span];
}

function overlaps(left: [number, number], right: [number, number]) {
  for (const shift of [0, 1440, -1440]) {
    const start = right[0] + shift;
    const end = right[1] + shift;
    if (left[0] < end && start < left[1]) return true;
  }
  return false;
}

/** Dates where the shift the planner sees is a work shift. A draft wins over the published row. */
export function conflictingWorkDates(dates: string[], rows: { date: string; kind: string; draft?: boolean }[]) {
  const effective = new Map<string, string>();
  const ordered = [...rows].sort((left, right) => Number(Boolean(left.draft)) - Number(Boolean(right.draft)));
  for (const row of ordered) effective.set(row.date, row.kind);
  return dates.filter((date) => effective.get(date) === "WORK");
}

export type SevenDayWarning = { userId: string; from: string; to: string; days: number };

/** Work dates that form 7 or more calendar days in a row and touch the shown week. */
export function sevenDayWorkWarnings(workDates: readonly { userId: string; date: string }[], weekDates: readonly string[]) {
  const focus = new Set(weekDates);
  const byUser = new Map<string, Set<string>>();
  for (const row of workDates) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
    const dates = byUser.get(row.userId) ?? new Set<string>();
    dates.add(row.date);
    byUser.set(row.userId, dates);
  }
  const warnings: SevenDayWarning[] = [];
  for (const [userId, dates] of byUser) {
    const sorted = [...dates].sort();
    let start = 0;
    for (let index = 1; index <= sorted.length; index += 1) {
      const continues = index < sorted.length && addDaysIso(sorted[index - 1], 1) === sorted[index];
      if (continues) continue;
      const run = sorted.slice(start, index);
      const overlapsWeek = focus.size === 0 || run.some((date) => focus.has(date));
      if (run.length >= 7 && overlapsWeek) warnings.push({ userId, from: run[0], to: run[run.length - 1], days: run.length });
      start = index;
    }
  }
  return warnings.sort((left, right) => left.from.localeCompare(right.from) || left.userId.localeCompare(right.userId));
}

export function shiftWarnings(input: { start: string; end: string; splitStart?: string; splitEnd?: string }) {
  const warnings: ShiftWarning[] = [];
  const first = spanMinutes(input.start, input.end);
  if (first != null && first > LONG_SHIFT_MINUTES) warnings.push({ code: "long", hours: Math.round((first / 60) * 10) / 10 });
  const splitStart = input.splitStart?.trim() ?? "";
  const splitEnd = input.splitEnd?.trim() ?? "";
  if (!splitStart && !splitEnd) return warnings;
  const second = spanMinutes(splitStart, splitEnd);
  if (second != null && second > LONG_SHIFT_MINUTES) warnings.push({ code: "splitLong", hours: Math.round((second / 60) * 10) / 10 });
  const left = range(input.start, input.end);
  const right = range(splitStart, splitEnd);
  if (left && right && overlaps(left, right)) warnings.push({ code: "overlap" });
  return warnings;
}
