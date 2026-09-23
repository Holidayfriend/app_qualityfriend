import type { LeaveCategory, LeaveDuration, AbsenceStatus } from "./leave-fields";
export type { LeaveCategory, LeaveDuration, AbsenceStatus } from "./leave-fields";

export type Dept = "reception" | "housekeeping" | "restaurant" | "management" | "maintenance";
export type ShiftKey = "f" | "m" | "s" | "off" | "vac" | "k" | "open";
export type AbsenceCategory = LeaveCategory;
export type ScheduleDepartment = { id: string; name: string };
export type ShiftCell = {
  kind: "empty" | "off" | "vac" | "work";
  start: string;
  end: string;
  breakMins: number;
  note: string;
  templateId: string;
  leaveCategory: LeaveCategory | "";
  leaveDuration: LeaveDuration | "";
  updatedBy: string;
  draft: boolean;
};
export type Employee = { key: string; name: string; departmentId: string; departmentName: string; shifts: ShiftCell[] };
export const EMPTY_CELL: ShiftCell = { kind: "empty", start: "", end: "", breakMins: 0, note: "", templateId: "", leaveCategory: "", leaveDuration: "", updatedBy: "", draft: false };
export const EMPTY_SHIFTS: ShiftCell[] = Array.from({ length: 7 }, () => ({ ...EMPTY_CELL }));
export type Absence = {
  id: string;
  employee: string;
  empKey: string;
  category: LeaveCategory;
  duration: LeaveDuration;
  start: string;
  end: string;
  startTime: string;
  endTime: string;
  note: string;
  status: AbsenceStatus;
  source: "request" | "direct";
  decidedBy: string;
};
export type Template = { id: string; name: string; start: string; end: string; breakMins: number; note: string };

export const DAY_DATES = ["2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25"];
export const INITIAL_EMPLOYEES: Employee[] = [];
export const INITIAL_ABSENCES: Absence[] = [];
export const INITIAL_TEMPLATES: Template[] = [];

export const DEPT_HOURS: { dept: Dept; hours: string; width: string; bar: "bar-a" | "bar-g" | "bar-b" }[] = [
  { dept: "reception", hours: "78h", width: "70%", bar: "bar-a" },
  { dept: "housekeeping", hours: "56h", width: "50%", bar: "bar-a" },
  { dept: "restaurant", hours: "112h", width: "90%", bar: "bar-g" },
  { dept: "management", hours: "66h", width: "60%", bar: "bar-b" },
];
