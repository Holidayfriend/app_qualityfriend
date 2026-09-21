"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n-provider";
import {
  EMPTY_SHIFTS, INITIAL_ABSENCES, INITIAL_TEMPLATES,
  type Absence, type AbsenceStatus, type Employee, type ScheduleDepartment, type ShiftKey, type Template,
} from "../../lib/schedule/demo-data";
import { addDaysIso, localTodayIso, mondayOfIso, weekIsoDates } from "../../lib/schedule/week";

type Store = {
  role: string;
  currentUserId: string;
  fullName: string;
  isPlanner: boolean;
  ready: boolean;
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
  setTemplates: (templates: Template[] | ((current: Template[]) => Template[])) => void;
  saveShift: (empKey: string, day: number, start: string, end: string, template: string) => void;
  decideAbsence: (index: number, status: AbsenceStatus) => void;
};

type StaffPayload = {
  currentUserId?: string;
  departments?: ScheduleDepartment[];
  employees?: { id: string; name: string; departmentId: string | null; departmentName: string }[];
};

const ScheduleContext = createContext<Store | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [role, setRole] = useState("ADMIN");
  const [currentUserId, setCurrentUserId] = useState("");
  const [fullName, setFullName] = useState("");
  const [ready, setReady] = useState(false);
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
    ]).then(async ([meRes, staffRes]) => {
      if (controller.signal.aborted) return;
      if (meRes.ok) {
        const user = await meRes.json() as { id?: string; first_name: string; last_name: string; role: string };
        if (controller.signal.aborted) return;
        setRole(user.role);
        setFullName(`${user.first_name} ${user.last_name}`.trim());
        if (user.id) setCurrentUserId(user.id);
      }
      if (!staffRes.ok) {
        setDepartments([]);
        setEmployees([]);
        return;
      }
      const staff = await staffRes.json() as StaffPayload;
      if (controller.signal.aborted) return;
      if (staff.currentUserId) setCurrentUserId(staff.currentUserId);
      const nextDepartments = Array.isArray(staff.departments) ? staff.departments : [];
      setDepartments(nextDepartments);
      const rows = Array.isArray(staff.employees) ? staff.employees : [];
      setEmployees((current) => rows.map((row) => {
        const previous = current.find((item) => item.key === row.id);
        return {
          key: row.id,
          name: row.name,
          departmentId: row.departmentId ?? "",
          departmentName: row.departmentName,
          shifts: previous?.shifts ?? [...EMPTY_SHIFTS],
        };
      }));
    }).catch(() => undefined).finally(() => {
      if (!controller.signal.aborted) setReady(true);
    });
    return () => controller.abort();
  }, [locale]);

  const isPlanner = role === "ADMIN" || role === "MANAGEMENT" || role === "TEAM_LEAD";

  function saveShift(empKey: string, day: number, start: string, end: string, template: string) {
    setEmployees((current) => current.map((emp) => {
      if (emp.key !== empKey) return emp;
      const shifts = [...emp.shifts];
      let key: ShiftKey = "k";
      if (template === "off") key = "off";
      else if (template === "vac") key = "vac";
      else key = start <= "08:00" ? "f" : start <= "13:00" ? "m" : "s";
      shifts[day] = key;
      return { ...emp, shifts };
    }));
  }

  function decideAbsence(index: number, status: AbsenceStatus) {
    setAbsences((current) => current.map((item, i) => i === index ? { ...item, status } : item));
    const item = absences[index];
    if (status === "approved" && item?.category === "vacation" && item.empKey) {
      setEmployees((current) => current.map((emp) => {
        if (emp.key !== item.empKey) return emp;
        return { ...emp, shifts: emp.shifts.map((shift, i) => weekDates[i] >= item.start && weekDates[i] <= item.end ? "vac" : shift) };
      }));
    }
  }

  const value = useMemo(() => ({
    role, currentUserId, fullName, isPlanner, ready, weekStartIso, weekDates,
    goToPrevWeek: () => setWeekStartIso((current) => addDaysIso(current, -7)),
    goToNextWeek: () => setWeekStartIso((current) => addDaysIso(current, 7)),
    departments, employees, absences, templates,
    setEmployees, setAbsences, setTemplates, saveShift, decideAbsence,
  }), [absences, currentUserId, departments, employees, fullName, isPlanner, ready, role, templates, weekDates, weekStartIso]);

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error("useSchedule must be used inside ScheduleProvider");
  return context;
}
