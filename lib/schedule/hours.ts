import type { ShiftCell } from "./demo-data";
import { spanMinutes } from "./shift-rules";

function blockHours(start: string, end: string, breakMins: number) {
  const mins = spanMinutes(start, end);
  if (mins == null) return 0;
  return Math.max(0, mins - Math.max(0, breakMins)) / 60;
}

export function shiftWorkHours(shift: Pick<ShiftCell, "kind" | "start" | "end" | "breakMins"> & Partial<Pick<ShiftCell, "splitStart" | "splitEnd" | "splitBreakMins">>) {
  if (shift.kind !== "work") return 0;
  const first = blockHours(shift.start, shift.end, shift.breakMins);
  const splitStart = shift.splitStart?.trim() ?? "";
  const splitEnd = shift.splitEnd?.trim() ?? "";
  if (!splitStart || !splitEnd) return first;
  return first + blockHours(splitStart, splitEnd, shift.splitBreakMins ?? 0);
}

export function weekWorkHours(employees: { shifts: ShiftCell[] }[]) {
  return employees.reduce((total, emp) => total + emp.shifts.reduce((sum, shift) => sum + shiftWorkHours(shift), 0), 0);
}

export function formatWorkHours(hours: number) {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
