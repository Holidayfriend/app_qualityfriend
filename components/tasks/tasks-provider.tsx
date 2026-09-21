"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n-provider";
import {
  type HotelDept,
  type HotelUser,
  type PublicChecklist,
  type PublicTask,
} from "../../lib/tasks/demo-data";

export type { HotelDept, HotelUser, PublicChecklist, PublicChecklistItem, PublicTask } from "../../lib/tasks/demo-data";

type TaskInput = {
  title: string;
  assignType: "dept" | "person";
  departmentId: string;
  assigneeId: string;
  dueIso: string;
  note: string;
};

type ChecklistInput = {
  title: string;
  desc: string;
  items: string[];
  assignType: "all" | "dept" | "person";
  departmentId: string;
  assigneeId: string;
  dueType: "once" | "recurring";
  recurrence: PublicChecklist["recurrence"];
  weekdays: string[];
  dueIso: string;
  startIso: string;
  endIso: string;
  noEnd: boolean;
  status: PublicChecklist["status"];
  kind: "checklist" | "template";
};

type Ctx = {
  tasks: PublicTask[];
  checklists: PublicChecklist[];
  templates: PublicChecklist[];
  departments: HotelDept[];
  users: HotelUser[];
  canManage: boolean;
  ready: boolean;
  openCount: number;
  overdueCount: number;
  dueTodayCount: number;
  dueWeekCount: number;
  doneWeek: number;
  totalWeek: number;
  periodic: PublicChecklist[];
  saveTask: (id: string | undefined, input: TaskInput) => Promise<string | null>;
  toggleTask: (id: string) => Promise<boolean>;
  saveChecklist: (id: string | undefined, input: ChecklistInput) => Promise<string | null>;
  setChecklistStatus: (id: string, status: "active" | "archived") => Promise<boolean>;
  toggleItem: (checklistId: string, itemId: string) => Promise<boolean>;
  completeChecklist: (id: string, comment: string) => Promise<boolean>;
};

const TasksContext = createContext<Ctx | null>(null);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function weekEndIso() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [tasks, setTasks] = useState<PublicTask[]>([]);
  const [checklists, setChecklists] = useState<PublicChecklist[]>([]);
  const [templates, setTemplates] = useState<PublicChecklist[]>([]);
  const [departments, setDepartments] = useState<HotelDept[]>([]);
  const [users, setUsers] = useState<HotelUser[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [listRes, optRes, meRes, clRes] = await Promise.all([
        fetch(`/api/tasks?locale=${locale}`, { cache: "no-store" }),
        fetch(`/api/tasks/options?locale=${locale}`, { cache: "no-store" }),
        fetch("/api/me", { cache: "no-store" }),
        fetch(`/api/checklists?locale=${locale}`, { cache: "no-store" }),
      ]);
      const list = listRes.ok ? await listRes.json() as { tasks?: PublicTask[]; canManage?: boolean } : null;
      const opt = optRes.ok ? await optRes.json() as { departments?: HotelDept[]; users?: HotelUser[] } : null;
      const me = meRes.ok ? await meRes.json() as { role?: string; allowed_modules?: string[] } : null;
      const cl = clRes.ok ? await clRes.json() as { checklists?: PublicChecklist[]; templates?: PublicChecklist[]; canManage?: boolean } : null;
      setTasks(Array.isArray(list?.tasks) ? list.tasks : []);
      setChecklists(Array.isArray(cl?.checklists) ? cl.checklists : []);
      setTemplates(Array.isArray(cl?.templates) ? cl.templates : []);
      setDepartments(Array.isArray(opt?.departments) ? opt.departments : []);
      setUsers(Array.isArray(opt?.users) ? opt.users : []);
      setCanManage(Boolean(list?.canManage || cl?.canManage) || me?.role === "ADMIN" || Boolean(me?.allowed_modules?.includes("tasks")));
    } catch {
      setTasks([]);
      setChecklists([]);
      setTemplates([]);
    } finally {
      setReady(true);
      if (typeof window !== "undefined") window.dispatchEvent(new Event("qf-shell-refresh"));
    }
  }, [locale]);

  useEffect(() => { void reload(); }, [reload]);

  const saveTask = useCallback(async (id: string | undefined, input: TaskInput) => {
    const res = await fetch(id ? `/api/tasks/${id}?locale=${locale}` : `/api/tasks?locale=${locale}`, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = await res.json() as { task?: { id: string } };
    await reload();
    return data.task?.id ?? id ?? null;
  }, [locale, reload]);

  const toggleTask = useCallback(async (id: string) => {
    let next: "open" | "done" = "done";
    setTasks((prev) => {
      const current = prev.find((item) => item.id === id);
      next = current?.status === "done" ? "open" : "done";
      return prev.map((item) => item.id === id ? { ...item, status: next } : item);
    });
    const res = await fetch(`/api/tasks/${id}?locale=${locale}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      await reload();
      return false;
    }
    await reload();
    return true;
  }, [locale, reload]);

  const saveChecklist = useCallback(async (id: string | undefined, input: ChecklistInput) => {
    const res = await fetch(id ? `/api/checklists/${id}?locale=${locale}` : `/api/checklists?locale=${locale}`, {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = await res.json() as { checklist?: { id: string } };
    await reload();
    return data.checklist?.id ?? id ?? null;
  }, [locale, reload]);

  const setChecklistStatus = useCallback(async (id: string, status: "active" | "archived") => {
    const res = await fetch(`/api/checklists/${id}?locale=${locale}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await reload();
    return res.ok;
  }, [locale, reload]);

  const toggleItem = useCallback(async (checklistId: string, itemId: string) => {
    const res = await fetch(`/api/checklists/${checklistId}?locale=${locale}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    await reload();
    return res.ok;
  }, [locale, reload]);

  const completeChecklist = useCallback(async (id: string, comment: string) => {
    const res = await fetch(`/api/checklists/${id}?locale=${locale}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true, comment }),
    });
    await reload();
    return res.ok;
  }, [locale, reload]);

  const today = todayIso();
  const week = weekEndIso();
  const open = tasks.filter((item) => item.status === "open");
  const overdue = open.filter((item) => item.dueIso && item.dueIso < today);
  const dueToday = open.filter((item) => item.dueIso === today);
  const dueWeek = open.filter((item) => item.dueIso && item.dueIso >= today && item.dueIso < week);
  const doneWeek = tasks.filter((item) => item.status === "done").length;
  const periodic = checklists.filter((item) => item.kind === "checklist" && item.status === "active" && !item.completedAt && (item.origin === "run" || (item.origin === "original" && Boolean(item.nextDueIso) && item.nextDueIso < week)));

  const value = useMemo<Ctx>(() => ({
    tasks, checklists, templates, departments, users, canManage, ready,
    openCount: open.length,
    overdueCount: overdue.length,
    dueTodayCount: dueToday.length,
    dueWeekCount: dueWeek.length + overdue.length,
    doneWeek,
    totalWeek: doneWeek + open.length,
    periodic,
    saveTask, toggleTask, saveChecklist, setChecklistStatus, toggleItem, completeChecklist,
  }), [canManage, checklists, completeChecklist, departments, doneWeek, dueToday.length, dueWeek.length, open.length, overdue.length, periodic, ready, saveChecklist, saveTask, setChecklistStatus, tasks, templates, toggleItem, toggleTask, users]);

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks");
  return ctx;
}
