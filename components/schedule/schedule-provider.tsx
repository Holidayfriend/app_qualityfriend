"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DAY_DATES, INITIAL_ABSENCES, INITIAL_EMPLOYEES, INITIAL_TEMPLATES,
  type Absence, type AbsenceStatus, type Employee, type ShiftKey, type Template,
} from "../../lib/schedule/demo-data";

type Store = {
  role: string;
  fullName: string;
  isPlanner: boolean;
  employees: Employee[];
  absences: Absence[];
  templates: Template[];
  setEmployees: (employees: Employee[] | ((current: Employee[]) => Employee[])) => void;
  setAbsences: (absences: Absence[] | ((current: Absence[]) => Absence[])) => void;
  setTemplates: (templates: Template[] | ((current: Template[]) => Template[])) => void;
  saveShift: (empKey: string, day: number, start: string, end: string, template: string) => void;
  decideAbsence: (index: number, status: AbsenceStatus) => void;
};

const ScheduleContext = createContext<Store | null>(null);

export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState("ADMIN");
  const [fullName, setFullName] = useState("Klaus Pichler");
  const [employees, setEmployees] = useState<Employee[]>(() => INITIAL_EMPLOYEES.map((item) => ({ ...item, shifts: [...item.shifts] })));
  const [absences, setAbsences] = useState<Absence[]>(INITIAL_ABSENCES);
  const [templates, setTemplates] = useState<Template[]>(INITIAL_TEMPLATES);

  useEffect(() => {
    fetch("/api/me").then(async (response) => {
      if (!response.ok) return;
      const user = await response.json() as { first_name: string; last_name: string; role: string };
      setRole(user.role);
      setFullName(`${user.first_name} ${user.last_name}`);
    }).catch(() => undefined);
  }, []);

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
        return { ...emp, shifts: emp.shifts.map((shift, i) => DAY_DATES[i] >= item.start && DAY_DATES[i] <= item.end ? "vac" : shift) };
      }));
    }
  }

  const value = useMemo(() => ({
    role, fullName, isPlanner, employees, absences, templates,
    setEmployees, setAbsences, setTemplates, saveShift, decideAbsence,
  }), [absences, employees, fullName, isPlanner, role, templates]);

  return <ScheduleContext.Provider value={value}>{children}</ScheduleContext.Provider>;
}

export function useSchedule() {
  const context = useContext(ScheduleContext);
  if (!context) throw new Error("useSchedule must be used inside ScheduleProvider");
  return context;
}
