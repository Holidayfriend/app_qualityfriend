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

/** Hours for the one department a person belongs to first, so a multi-department person is counted once. */
export function hoursForHomeDepartment(employees: { departmentId: string; departmentIds: string[]; shifts: Parameters<typeof shiftWorkHours>[0][] }[]) {
  const totals = new Map<string, number>();
  for (const employee of employees) {
    const home = employee.departmentIds.includes(employee.departmentId) ? employee.departmentId : employee.departmentIds[0] ?? "";
    if (!home) continue;
    const hours = employee.shifts.reduce((sum, shift) => sum + shiftWorkHours(shift), 0);
    totals.set(home, (totals.get(home) ?? 0) + hours);
  }
  return totals;
}

export function formatWorkHours(hours: number) {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
