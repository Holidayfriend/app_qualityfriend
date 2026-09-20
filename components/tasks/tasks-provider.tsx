"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n-provider";
import {
  seedChecklists,
  seedTemplates,
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
  saveChecklist: (id: string | undefined, input: ChecklistInput) => string;
  toggleItem: (checklistId: string, itemId: string) => void;
  completeChecklist: (id: string, comment: string) => void;
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

function nid() {
  return `ui-${Math.random().toString(36).slice(2, 10)}`;
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
      const [listRes, optRes, meRes] = await Promise.all([
        fetch(`/api/tasks?locale=${locale}`, { cache: "no-store" }),
        fetch(`/api/tasks/options?locale=${locale}`, { cache: "no-store" }),
        fetch("/api/me", { cache: "no-store" }),
      ]);
      const list = listRes.ok ? await listRes.json() as { tasks?: PublicTask[]; canManage?: boolean } : null;
      const opt = optRes.ok ? await optRes.json() as { departments?: HotelDept[]; users?: HotelUser[] } : null;
      const me = meRes.ok ? await meRes.json() as { role?: string; allowed_modules?: string[] } : null;
      setTasks(Array.isArray(list?.tasks) ? list.tasks : []);
      setDepartments(Array.isArray(opt?.departments) ? opt.departments : []);
      setUsers(Array.isArray(opt?.users) ? opt.users : []);
      setCanManage(Boolean(list?.canManage) || me?.role === "ADMIN" || Boolean(me?.allowed_modules?.includes("tasks")));
    } catch {
      setTasks([]);
    } finally {
      setChecklists(seedChecklists(locale));
      setTemplates(seedTemplates(locale));
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

  const saveChecklist = useCallback((id: string | undefined, input: ChecklistInput) => {
    const nextId = id || nid();
    const dept = departments.find((item) => item.id === input.departmentId);
    const person = users.find((item) => item.id === input.assigneeId);
    const items = input.items.filter(Boolean).map((text, index) => ({ id: `${nextId}-${index}`, text, state: "open" as const, comment: "" }));
    const row: PublicChecklist = {
      id: nextId,
      kind: input.kind,
      title: input.title.trim(),
      desc: input.desc,
      status: input.status,
      assignType: input.assignType,
      assignee: input.assignType === "person" ? (person?.name ?? "") : input.assignType === "dept" ? (dept?.name ?? "") : "",
      assigneeId: input.assigneeId,
      departmentId: input.departmentId,
      dueType: input.dueType,
      recurrence: input.dueType === "once" ? "once" : input.recurrence,
      weekdays: input.weekdays,
      dueIso: input.dueIso,
      startIso: input.startIso,
      endIso: input.noEnd ? "" : input.endIso,
      nextDue: input.dueType === "once" ? input.dueIso : input.startIso || todayIso(),
      nextDueIso: input.dueType === "once" ? input.dueIso : input.startIso || todayIso(),
      items,
      progress: `0/${items.length}`,
      completions: [],
    };
    if (input.kind === "template") {
      setTemplates((prev) => id ? prev.map((item) => item.id === id ? row : item) : [row, ...prev]);
    } else {
      setChecklists((prev) => id ? prev.map((item) => item.id === id ? { ...row, completions: item.completions, items: item.items.length === items.length ? item.items.map((cur, i) => ({ ...cur, text: items[i]?.text ?? cur.text })) : items } : item) : [row, ...prev]);
    }
    return nextId;
  }, [departments, users]);

  const toggleItem = useCallback((checklistId: string, itemId: string) => {
    setChecklists((prev) => prev.map((row) => {
      if (row.id !== checklistId) return row;
      const items = row.items.map((item) => item.id !== itemId ? item : { ...item, state: item.state === "open" ? "done" : item.state === "done" ? "exception" : "open" });
      const done = items.filter((item) => item.state === "done").length;
      return { ...row, items, progress: `${done}/${items.length}` };
    }));
  }, []);

  const completeChecklist = useCallback((id: string, comment: string) => {
    setChecklists((prev) => prev.map((row) => {
      if (row.id !== id) return row;
      const items = row.dueType === "recurring" ? row.items.map((item) => ({ ...item, state: "open" as const, comment: item.state === "exception" ? comment : item.comment })) : row.items;
      return {
        ...row,
        items,
        status: row.dueType === "once" ? "archived" : row.status,
        completions: [{ id: nid(), result: "done", author: "You", date: todayIso() }, ...row.completions].slice(0, 8),
      };
    }));
  }, []);

  const today = todayIso();
  const week = weekEndIso();
  const open = tasks.filter((item) => item.status === "open");
  const overdue = open.filter((item) => item.dueIso && item.dueIso < today);
  const dueToday = open.filter((item) => item.dueIso === today);
  const dueWeek = open.filter((item) => item.dueIso && item.dueIso >= today && item.dueIso < week);
  const doneWeek = tasks.filter((item) => item.status === "done").length;
  const periodic = checklists.filter((item) => item.status === "active" && item.nextDueIso && item.nextDueIso >= isoOffset(-1) && item.nextDueIso < week);

  const value = useMemo<Ctx>(() => ({
    tasks, checklists, templates, departments, users, canManage, ready,
    openCount: open.length,
    overdueCount: overdue.length,
    dueTodayCount: dueToday.length,
    dueWeekCount: dueWeek.length + overdue.length,
    doneWeek,
    totalWeek: doneWeek + open.length,
    periodic,
    saveTask, toggleTask, saveChecklist, toggleItem, completeChecklist,
  }), [canManage, checklists, completeChecklist, departments, doneWeek, dueToday.length, dueWeek.length, open.length, overdue.length, periodic, ready, saveChecklist, saveTask, tasks, templates, toggleItem, toggleTask, users]);

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

function isoOffset(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks");
  return ctx;
}
