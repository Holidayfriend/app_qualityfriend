"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n-provider";
import {
  EMPTY_CELL, EMPTY_SHIFTS, INITIAL_ABSENCES, INITIAL_TEMPLATES,
  type Absence, type AbsenceStatus, type Employee, type ScheduleDepartment, type ShiftCell, type Template,
} from "../../lib/schedule/demo-data";
import { addDaysIso, localTodayIso, mondayOfIso, weekIsoDates } from "../../lib/schedule/week";

type TemplateInput = { name: string; start: string; end: string; breakMins: string; note: string };
type ShiftInput = {
  empKey: string;
  day: number;
  start: string;
  end: string;
  breakMins: string;
  note: string;
  template: string;
  repeatWeeks: number;
};

type PublicShift = {
  userId: string;
  date: string;
  kind: "work" | "off" | "vac";
  start: string;
  end: string;
  breakMins: number;
  note: string;
  templateId: string;
};

type Store = {
  role: string;
  currentUserId: string;
  fullName: string;
  isPlanner: boolean;
  ready: boolean;
  shiftsReady: boolean;
  weekStartIso: string;
  weekDates: string[];
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  departments: ScheduleDepartment[];
  employees: Employee[];
  absences: Absence[];
  templates: Template[];
  setEmployees: (employees: Employee[] | ((current: Employee[]) => Employee[])) => void;
  setAbsences: (absences: Absence[] | ((current: Absence[]) => Absence[])) => void;
  saveShift: (input: ShiftInput) => Promise<number | null>;
  decideAbsence: (index: number, status: AbsenceStatus) => void;
  saveTemplate: (id: string | undefined, input: TemplateInput) => Promise<string | null>;
  deleteTemplate: (id: string) => Promise<boolean>;
};

type StaffPayload = {
  currentUserId?: string;
  departments?: ScheduleDepartment[];
  employees?: { id: string; name: string; departmentId: string | null; departmentName: string }[];
};

const ScheduleContext = createContext<Store | null>(null);

function asTemplates(value: unknown): Template[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<Template>;
    if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.start !== "string" || typeof row.end !== "string") return [];
    return [{
      id: row.id,
      name: row.name,
      start: row.start,
      end: row.end,
      breakMins: typeof row.breakMins === "number" ? row.breakMins : 0,
      note: typeof row.note === "string" ? row.note : "",
    }];
  });
}

function asShifts(value: unknown): PublicShift[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<PublicShift>;
    if (typeof row.userId !== "string" || typeof row.date !== "string") return [];
    const kind = row.kind === "off" || row.kind === "vac" ? row.kind : "work";
    return [{
      userId: row.userId,
      date: row.date,
      kind,
      start: typeof row.start === "string" ? row.start : "",
      end: typeof row.end === "string" ? row.end : "",
      breakMins: typeof row.breakMins === "number" ? row.breakMins : 0,
      note: typeof row.note === "string" ? row.note : "",
      templateId: typeof row.templateId === "string" ? row.templateId : "",
    }];
  });
}

function cellFromShift(row: PublicShift | undefined): ShiftCell {
  if (!row) return { ...EMPTY_CELL };
  return {
    kind: row.kind,
    start: row.start,
    end: row.end,
    breakMins: row.breakMins,
    note: row.note,
    templateId: row.templateId,
  };
}

function mergeWeekShifts(employees: Employee[], weekDates: string[], shifts: PublicShift[]) {
  return employees.map((emp) => ({
    ...emp,
    shifts: weekDates.map((date) => cellFromShift(shifts.find((row) => row.userId === emp.key && row.date === date))),
  }));
}

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [role, setRole] = useState("EMPLOYEE");
  const [canManageSchedule, setCanManageSchedule] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [ready, setReady] = useState(false);
  const [shiftsReady, setShiftsReady] = useState(false);
  const [weekStartIso, setWeekStartIso] = useState(() => mondayOfIso(localTodayIso()));
  const [departments, setDepartments] = useState<ScheduleDepartment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [absences, setAbsences] = useState<Absence[]>(INITIAL_ABSENCES);
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);
  const weekDates = useMemo(() => weekIsoDates(weekStartIso), [weekStartIso]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/me", { cache: "no-store", signal: controller.signal }),
      fetch(`/api/schedule/staff?locale=${locale}`, { cache: "no-store", signal: controller.signal }),
      fetch(`/api/schedule/templates?locale=${locale}`, { cache: "no-store", signal: controller.signal }),
    ]).then(async ([meRes, staffRes, tplRes]) => {
      if (controller.signal.aborted) return;
      if (meRes.ok) {
        const user = await meRes.json() as { id?: string; first_name: string; last_name: string; role: string; allowed_modules?: string[] };
        if (controller.signal.aborted) return;
        setRole(user.role);
        setCanManageSchedule(user.role === "ADMIN" || (user.allowed_modules ?? []).includes("schedule"));
        setFullName(`${user.first_name} ${user.last_name}`.trim());
        if (user.id) setCurrentUserId(user.id);
      }
      if (staffRes.ok) {
        const staff = await staffRes.json() as StaffPayload;
        if (controller.signal.aborted) return;
        if (staff.currentUserId) setCurrentUserId(staff.currentUserId);
        setDepartments(Array.isArray(staff.departments) ? staff.departments : []);
        const rows = Array.isArray(staff.employees) ? staff.employees : [];
        setEmployees(rows.map((row) => ({
          key: row.id,
          name: row.name,
          departmentId: row.departmentId ?? "",
          departmentName: row.departmentName,
          shifts: [...EMPTY_SHIFTS.map((cell) => ({ ...cell }))],
        })));
      } else {
        setDepartments([]);
        setEmployees([]);
      }
      if (tplRes.ok) {
        const body = await tplRes.json() as { templates?: unknown };
        if (!controller.signal.aborted) setTemplates(asTemplates(body.templates));
      } else {
        setTemplates([]);
      }
    }).catch(() => undefined).finally(() => {
      if (!controller.signal.aborted) setReady(true);
    });
    return () => controller.abort();
  }, [locale]);

  const reloadWeekShifts = useCallback(async (signal?: AbortSignal) => {
    setShiftsReady(false);
    try {
      const response = await fetch(`/api/schedule/shifts?weekStart=${weekStartIso}&locale=${locale}`, { cache: "no-store", signal });
      if (!response.ok) return;
      const body = await response.json() as { shifts?: unknown };
      const shifts = asShifts(body.shifts);
      setEmployees((current) => mergeWeekShifts(current, weekDates, shifts));
    } finally {
      if (!signal?.aborted) setShiftsReady(true);
    }
  }, [locale, weekDates, weekStartIso]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    void reloadWeekShifts(controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [ready, reloadWeekShifts]);

  const isPlanner = canManageSchedule;

  const saveShift = useCallback(async (input: ShiftInput) => {
    const date = weekDates[input.day];
    if (!date) return null;
    const response = await fetch(`/api/schedule/shifts?locale=${locale}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: input.empKey,
        date,
        start: input.start,
        end: input.end,
        breakMins: input.breakMins,
        note: input.note,
        template: input.template,
        repeatWeeks: input.repeatWeeks,
      }),
    });
    if (!response.ok) return null;
    const body = await response.json() as { repeatWeeks?: number };
    await reloadWeekShifts().catch(() => undefined);
    return typeof body.repeatWeeks === "number" ? body.repeatWeeks : input.repeatWeeks;
  }, [locale, reloadWeekShifts, weekDates]);

  function decideAbsence(index: number, status: AbsenceStatus) {
    setAbsences((current) => current.map((item, i) => i === index ? { ...item, status } : item));
    const item = absences[index];
    if (status === "approved" && item?.category === "vacation" && item.empKey) {
      setEmployees((current) => current.map((emp) => {
        if (emp.key !== item.empKey) return emp;
        return {
          ...emp,
          shifts: emp.shifts.map((shift, i) => weekDates[i] >= item.start && weekDates[i] <= item.end
            ? { ...EMPTY_CELL, kind: "vac" as const }
            : shift),
        };
      }));
    }
  }

  const saveTemplate = useCallback(async (id: string | undefined, input: TemplateInput) => {
    const payload = { name: input.name, start: input.start, end: input.end, breakMins: input.breakMins, note: input.note };
    const response = await fetch(id ? `/api/schedule/templates/${id}?locale=${locale}` : `/api/schedule/templates?locale=${locale}`, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    const body = await response.json() as { template?: Template };
    const saved = body.template;
    if (!saved?.id) return null;
    setTemplates((current) => {
      const next = current.filter((item) => item.id !== saved.id);
      return [...next, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    return saved.id;
  }, [locale]);

  const deleteTemplate = useCallback(async (id: string) => {
    const response = await fetch(`/api/schedule/templates/${id}`, { method: "DELETE" });
    if (!response.ok) return false;
    setTemplates((current) => current.filter((item) => item.id !== id));
    return true;
  }, []);

  const value = useMemo(() => ({
    role, currentUserId, fullName, isPlanner, ready, shiftsReady, weekStartIso, weekDates,
    goToPrevWeek: () => setWeekStartIso((current) => addDaysIso(current, -7)),
    goToNextWeek: () => setWeekStartIso((current) => addDaysIso(current, 7)),
    departments, employees, absences, templates,
    setEmployees, setAbsences, saveShift, decideAbsence, saveTemplate, deleteTemplate,
  }), [absences, canManageSchedule, currentUserId, deleteTemplate, departments, employees, fullName, isPlanner, ready, role, saveShift, saveTemplate, shiftsReady, templates, weekDates, weekStartIso]);

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error("useSchedule must be used inside ScheduleProvider");
  return context;
}
