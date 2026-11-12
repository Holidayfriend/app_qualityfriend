type PeriodicRow = {
  kind: string;
  status: string;
  completedAt?: string | null;
  origin: string;
  nextDueIso?: string | null;
};

// Today and the six days before it, as [start, end).
export function lastSevenDayBounds(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  const start = new Date(date);
  start.setUTCDate(start.getUTCDate() - 6);
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function periodicLastSevenDays<T extends PeriodicRow>(rows: readonly T[], today: string) {
  const { start, end } = lastSevenDayBounds(today);
  return rows
    .filter((item) => {
      if (item.kind !== "checklist" || item.status !== "active" || item.completedAt) return false;
      if (item.origin !== "run" && item.origin !== "original") return false;
      return Boolean(item.nextDueIso && item.nextDueIso >= start && item.nextDueIso < end);
    })
    .sort((left, right) => (left.nextDueIso || "").localeCompare(right.nextDueIso || ""));
}
