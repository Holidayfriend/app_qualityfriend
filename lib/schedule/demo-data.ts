export type Dept = "reception" | "housekeeping" | "restaurant" | "management" | "maintenance";
export type ShiftKey = "f" | "m" | "s" | "off" | "vac" | "k" | "open";
export type AbsenceStatus = "open" | "approved" | "rejected";
export type AbsenceCategory = "vacation" | "sick" | "swap";
export type ScheduleDepartment = { id: string; name: string };
export type Employee = { key: string; name: string; departmentId: string; departmentName: string; shifts: ShiftKey[] };
export const EMPTY_SHIFTS: ShiftKey[] = ["off", "off", "off", "off", "off", "off", "off"];
export type Absence = { employee: string; empKey: string; category: AbsenceCategory; start: string; end: string; note: string; status: AbsenceStatus };
export type Template = { name: string; start: string; end: string };

export const DAY_DATES = ["2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25"];

export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_ABSENCES: Absence[] = [];

export const INITIAL_TEMPLATES: Template[] = [
  { name: "early", start: "07:00", end: "15:00" },
  { name: "mid", start: "11:00", end: "19:00" },
  { name: "late", start: "15:00", end: "23:00" },
];

export const DEPT_HOURS: { dept: Dept; hours: string; width: string; bar: "bar-a" | "bar-g" | "bar-b" }[] = [
  { dept: "reception", hours: "78h", width: "70%", bar: "bar-a" },
  { dept: "housekeeping", hours: "56h", width: "50%", bar: "bar-a" },
  { dept: "restaurant", hours: "112h", width: "90%", bar: "bar-g" },
  { dept: "management", hours: "66h", width: "60%", bar: "bar-b" },
];
