export type LeaveCategory = "paid" | "unpaid" | "paidSick" | "swap";
export type LeaveDuration = "full" | "partial";
export type AbsenceStatus = "open" | "approved" | "rejected";

export function asLeaveCategory(value: unknown): LeaveCategory | null {
  return value === "paid" || value === "unpaid" || value === "paidSick" || value === "swap" ? value : null;
}

export function asLeaveDuration(value: unknown): LeaveDuration | null {
  return value === "full" || value === "partial" ? value : null;
}

export function toDbCategory(value: LeaveCategory) {
  if (value === "unpaid") return "UNPAID";
  if (value === "paidSick") return "PAID_SICK";
  if (value === "swap") return "SWAP";
  return "PAID";
}

export function fromDbCategory(value: string): LeaveCategory {
  if (value === "UNPAID" || value === "unpaid") return "unpaid";
  if (value === "PAID_SICK" || value === "paidSick") return "paidSick";
  if (value === "SWAP" || value === "swap") return "swap";
  return "paid";
}

export function toDbDuration(value: LeaveDuration) {
  return value === "partial" ? "PARTIAL" : "FULL";
}

export function fromDbDuration(value: string): LeaveDuration {
  return value === "PARTIAL" || value === "partial" ? "partial" : "full";
}

export function personName(user?: { firstName: string; lastName: string } | null) {
  if (!user) return "";
  return `${user.firstName} ${user.lastName}`.trim();
}

export function datesInclusive(start: string, end: string) {
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  if (!DATE.test(start) || !DATE.test(end) || end < start) return [];
  const dates: string[] = [];
  let current = start;
  while (current <= end && dates.length < 62) {
    dates.push(current);
    const next = new Date(`${current}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    current = next.toISOString().slice(0, 10);
  }
  return dates;
}
