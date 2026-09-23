import type { ShiftCell } from "./demo-data";

function clockMins(value: string) {
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)/);
  if (!match) return null;
  const hours = Number(match[1]);
  if (hours > 23) return null;
  return hours * 60 + Number(match[2]);
}

export function shiftWorkHours(shift: Pick<ShiftCell, "kind" | "start" | "end" | "breakMins">) {
  if (shift.kind !== "work") return 0;
  const start = clockMins(shift.start);
  const end = clockMins(shift.end);
  if (start == null || end == null) return 0;
  let mins = end - start;
  if (mins <= 0) mins += 24 * 60;
  return Math.max(0, mins - Math.max(0, shift.breakMins)) / 60;
}

export function weekWorkHours(employees: { shifts: ShiftCell[] }[]) {
  return employees.reduce((total, emp) => total + emp.shifts.reduce((sum, shift) => sum + shiftWorkHours(shift), 0), 0);
}

export function formatWorkHours(hours: number) {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
