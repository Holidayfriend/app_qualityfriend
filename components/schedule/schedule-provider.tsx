"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n-provider";
import {
  EMPTY_CELL, EMPTY_SHIFTS, INITIAL_ABSENCES, INITIAL_TEMPLATES,
  type Absence, type AbsenceStatus, type Employee, type LeaveCategory, type LeaveDuration, type ScheduleDepartment, type ShiftCell, type Template,
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
  repeat: string;
  leaveCategory: LeaveCategory;
  leaveDuration: LeaveDuration;
};
type AbsenceInput = {
  userId: string;
  start: string;
  end: string;
  category: LeaveCategory;
  duration: LeaveDuration;
  startTime: string;
  endTime: string;
  note: string;
  applyDirect: boolean;
  swapWithUserId?: string;
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
  leaveCategory?: LeaveCategory | "";
  leaveDuration?: LeaveDuration | "";
  updatedBy?: string;
  draft?: boolean;
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
  goToWeek: (iso: string) => void;
  departments: ScheduleDepartment[];
  employees: Employee[];
  absences: Absence[];
  templates: Template[];
  draftCount: number;
  setEmployees: (employees: Employee[] | ((current: Employee[]) => Employee[])) => void;
  saveShift: (input: ShiftInput) => Promise<number | null>;
  publishWeek: () => Promise<{ cells: number; employees: number } | null>;
  copyWeekTo: (toWeekStart: string) => Promise<{ cells: number; targetWeekStart: string } | null>;
  saveAbsence: (input: AbsenceInput) => Promise<boolean>;
  decideAbsence: (id: string, status: AbsenceStatus) => Promise<boolean>;
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

function asLeaveCategory(value: unknown): LeaveCategory | "" {
  return value === "paid" || value === "unpaid" || value === "paidSick" || value === "swap" || value === "vacation" ? value : "";
}

function asLeaveDuration(value: unknown): LeaveDuration | "" {
  return value === "full" || value === "partial" ? value : "";
}

function asShifts(value: unknown): PublicShift[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<PublicShift> & { leaveCategory?: unknown; leaveDuration?: unknown };
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
      leaveCategory: asLeaveCategory(row.leaveCategory),
      leaveDuration: asLeaveDuration(row.leaveDuration),
      updatedBy: typeof row.updatedBy === "string" ? row.updatedBy : "",
      draft: row.draft === true,
    }];
  });
}

function asAbsences(value: unknown): Absence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Partial<Absence> & { startDate?: unknown; endDate?: unknown; userId?: unknown };
    const start = typeof row.start === "string" ? row.start.slice(0, 10) : typeof row.startDate === "string" ? row.startDate.slice(0, 10) : "";
    const id = typeof row.id === "string" ? row.id : "";
    const empKey = typeof row.empKey === "string" ? row.empKey : typeof row.userId === "string" ? row.userId : "";
    if (!id || !start) return [];
    const category = asLeaveCategory(row.category);
    if (!category) return [];
    return [{
      id,
      employee: typeof row.employee === "string" ? row.employee : "",
      empKey,
      category,
      duration: asLeaveDuration(row.duration) || "full",
      start,
      end: (typeof row.end === "string" ? row.end : typeof row.endDate === "string" ? row.endDate : start).slice(0, 10),
      startTime: typeof row.startTime === "string" ? row.startTime : "",
      endTime: typeof row.endTime === "string" ? row.endTime : "",
      note: typeof row.note === "string" ? row.note : "",
      status: row.status === "approved" || row.status === "rejected" ? row.status : "open",
      source: row.source === "direct" ? "direct" : "request",
      decidedBy: typeof row.decidedBy === "string" ? row.decidedBy : "",
      swapWith: typeof row.swapWith === "string" ? row.swapWith : "",
      swapWithUserId: typeof row.swapWithUserId === "string" ? row.swapWithUserId : "",
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
    leaveCategory: row.leaveCategory || "",
    leaveDuration: row.leaveDuration || "",
    updatedBy: row.updatedBy || "",
    draft: row.draft === true,
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
  const [draftCount, setDraftCount] = useState(0);
  const weekDates = useMemo(() => weekIsoDates(weekStartIso), [weekStartIso]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/me", { cache: "no-store", signal: controller.signal }),
      fetch(`/api/schedule/staff?locale=${locale}`, { cache: "no-store", signal: controller.signal }),
      fetch(`/api/schedule/templates?locale=${locale}`, { cache: "no-store", signal: controller.signal }),
      fetch(`/api/schedule/absences?locale=${locale}`, { cache: "no-store", signal: controller.signal }),
    ]).then(async ([meRes, staffRes, tplRes, absRes]) => {
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
      if (absRes.ok) {
        const body = await absRes.json() as { absences?: unknown };
        if (!controller.signal.aborted) setAbsences(asAbsences(body.absences));
      } else {
        setAbsences([]);
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
      const body = await response.json() as { shifts?: unknown; draftCount?: unknown };
      const shifts = asShifts(body.shifts);
      setEmployees((current) => mergeWeekShifts(current, weekDates, shifts));
      setDraftCount(typeof body.draftCount === "number" ? body.draftCount : 0);
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
        repeat: input.repeat,
        leaveCategory: input.leaveCategory,
        leaveDuration: input.leaveDuration,
      }),
    });
    const body = await response.json().catch(() => ({})) as { dayCount?: number; error?: string; detail?: string };
    if (!response.ok) throw new Error(body.detail || body.error || "SAVE_FAILED");
    await reloadWeekShifts().catch(() => undefined);
    return typeof body.dayCount === "number" ? body.dayCount : 1;
  }, [locale, reloadWeekShifts, weekDates]);

  const publishWeek = useCallback(async () => {
    const response = await fetch("/api/schedule/publish", { method: "POST" });
    if (!response.ok) return null;
    const body = await response.json() as { cells?: number; employees?: number };
    await reloadWeekShifts().catch(() => undefined);
    return { cells: typeof body.cells === "number" ? body.cells : 0, employees: typeof body.employees === "number" ? body.employees : 0 };
  }, [reloadWeekShifts]);

  const copyWeekTo = useCallback(async (toWeekStart: string) => {
    const response = await fetch("/api/schedule/copy-week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromWeekStart: weekStartIso, toWeekStart }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error || "SAVE_FAILED");
    }
    const body = await response.json() as { cells?: number; targetWeekStart?: string };
    const target = typeof body.targetWeekStart === "string" ? body.targetWeekStart : toWeekStart;
    setWeekStartIso(target);
    return { cells: typeof body.cells === "number" ? body.cells : 0, targetWeekStart: target };
  }, [weekStartIso]);

  const saveAbsence = useCallback(async (input: AbsenceInput) => {
    const response = await fetch(`/api/schedule/absences?locale=${locale}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) return false;
    const body = await response.json() as { absence?: Absence };
    if (body.absence) setAbsences((current) => [body.absence as Absence, ...current.filter((item) => item.id !== body.absence?.id)]);
    if (input.applyDirect) await reloadWeekShifts().catch(() => undefined);
    return true;
  }, [locale, reloadWeekShifts]);

  const decideAbsence = useCallback(async (id: string, status: AbsenceStatus) => {
    const response = await fetch(`/api/schedule/absences/${id}?locale=${locale}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) return false;
    const body = await response.json() as { absence?: Absence };
    if (body.absence) setAbsences((current) => current.map((item) => item.id === id ? body.absence as Absence : item));
    if (status === "approved") await reloadWeekShifts().catch(() => undefined);
    return true;
  }, [locale, reloadWeekShifts]);

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

  const goToWeek = useCallback((iso: string) => {
    setWeekStartIso(mondayOfIso(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : localTodayIso()));
  }, []);

  const value = useMemo(() => ({
    role, currentUserId, fullName, isPlanner, ready, shiftsReady, weekStartIso, weekDates,
    goToPrevWeek: () => setWeekStartIso((current) => addDaysIso(current, -7)),
    goToNextWeek: () => setWeekStartIso((current) => addDaysIso(current, 7)),
    goToWeek,
    departments, employees, absences, templates, draftCount,
    setEmployees, saveShift, publishWeek, copyWeekTo, saveAbsence, decideAbsence, saveTemplate, deleteTemplate,
  }), [absences, copyWeekTo, currentUserId, decideAbsence, deleteTemplate, departments, draftCount, employees, fullName, goToWeek, isPlanner, publishWeek, ready, role, saveAbsence, saveShift, saveTemplate, shiftsReady, templates, weekDates, weekStartIso]);

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error("useSchedule must be used inside ScheduleProvider");
  return context;
}
