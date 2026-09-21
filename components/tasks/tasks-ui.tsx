"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { BrandLoader } from "../ui/brand-loader";
import { useToast } from "../ui/toast-provider";
import { getTasksMessages, type TasksMessages } from "../../lib/i18n/tasks-messages";
import { useTasks, type PublicChecklist, type PublicTask } from "./tasks-provider";

type T = TasksMessages;
const WEEKDAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"] as const;

function useT() {
  const { locale } = useI18n();
  return getTasksMessages(locale);
}

function fill(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return <AppShell activeItem="tasks" pageTitle={title}><main className="qf-dashboard pb-24 lg:pb-[24px]">{children}</main></AppShell>;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function prio(task: PublicTask, t: T) {
  if (task.status === "done") return { chip: "chip-g", label: t.done };
  if (!task.dueIso) return { chip: "chip-n", label: t.low };
  if (task.dueIso < todayIso()) return { chip: "chip-r", label: t.urgent };
  if (task.dueIso === todayIso()) return { chip: "chip-r", label: t.high };
  const week = new Date();
  week.setDate(week.getDate() + 7);
  if (task.dueIso <= week.toISOString().slice(0, 10)) return { chip: "chip-a", label: t.medium };
  return { chip: "chip-n", label: t.low };
}

function weekdayLabel(key: string, t: T) {
  return { mo: t.wdMo, tu: t.wdTu, we: t.wdWe, th: t.wdTh, fr: t.wdFr, sa: t.wdSa, su: t.wdSu }[key] ?? key;
}

function recurrenceLabel(item: PublicChecklist, t: T) {
  if (item.dueType === "once") return t.repeatOnce;
  return { once: t.repeatOnce, daily: t.daily, weekly: t.weekly, monthly: t.monthly, quarterly: t.quarterly, yearly: t.yearly }[item.recurrence] ?? t.weekly;
}

function statusChip(status: PublicChecklist["status"]) {
  return status === "active" ? "chip-g" : status === "draft" ? "chip-a" : "chip-n";
}

function statusLabel(status: PublicChecklist["status"], t: T) {
  return status === "active" ? t.statusActive : status === "draft" ? t.statusDraft : t.statusArchived;
}

function aiToday(tasks: PublicTask[]) {
  const today = todayIso();
  return [...tasks].sort((a, b) => {
    const score = (item: PublicTask) => {
      if (item.status === "done") return 40;
      if (!item.dueIso) return 20;
      if (item.dueIso < today) return 0;
      if (item.dueIso === today) return 1;
      return 10 + item.dueIso.localeCompare(today);
    };
    return score(a) - score(b);
  }).slice(0, 7);
}

export function TasksDashboardPage() {
  const t = useT();
  const { tasks, templates, canManage, ready, openCount, overdueCount, dueTodayCount, dueWeekCount, doneWeek, totalWeek, periodic, toggleTask } = useTasks();
  const [dept, setDept] = useState("all");
  if (!ready) return <Shell title={t.pageTitle}><BrandLoader label={t.loading} /></Shell>;
  const today = aiToday(tasks);
  const deptNames = [...new Set(today.map((item) => item.assignee).filter(Boolean))];
  const shown = today.filter((item) => dept === "all" || item.assignee === dept);
  const pct = totalWeek ? Math.round((doneWeek / totalWeek) * 100) : 0;
  const weekBars = [...tasks.reduce((map, task) => {
    const name = task.assignee.trim();
    if (!name) return map;
    const entry = map.get(name) ?? { name, done: 0, total: 0 };
    entry.total += 1;
    if (task.status === "done") entry.done += 1;
    map.set(name, entry);
    return map;
  }, new Map<string, { name: string; done: number; total: number }>()).values()].sort((a, b) => b.total - a.total);

  return <Shell title={t.pageTitle}>
    <div className="filter-row" style={{ marginBottom: 18 }}>
      <Link href="/tasks" className="filter-btn active" style={{ padding: "8px 16px", fontSize: 13 }}>{t.tabToday}</Link>
      <Link href="/tasks/list" className="filter-btn" style={{ padding: "8px 16px", fontSize: 13 }}>{t.tabTasks}</Link>
      <Link href="/tasks/checklists" className="filter-btn" style={{ padding: "8px 16px", fontSize: 13 }}>{t.tabChecklists}</Link>
    </div>
    <div className="ai-banner" style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 20 }}>✨</div>
      <div style={{ flex: 1 }}>
        <div className="ai-title">{t.aiTitle}</div>
        <div className="ai-body">{fill(t.aiBody, { total: String(openCount), today: String(dueTodayCount || today.filter((item) => item.status !== "done").length) })}</div>
      </div>
      <button type="button" className="ai-btn">{t.aiCriteria}</button>
    </div>
    <div className="g2e" style={{ marginBottom: 18 }}>
      <div className="kpi"><div className="kpi-lbl">{t.kpiOpen}</div><div className="kpi-val">{openCount}</div><div className="kpi-sub"><span className="chip chip-r">{fill(t.kpiToday, { count: String(dueTodayCount) })}</span></div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiWeek}</div><div className="kpi-val">{dueWeekCount}</div><div className="kpi-sub"><span className="chip chip-a">{fill(t.kpiOverdue, { count: String(overdueCount) })}</span></div></div>
    </div>
    <div className="g2">
      <div>
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="ch"><div className="ct">{t.aiPriorities}</div><Link href="/tasks/list" className="ca">{fill(t.showAll, { count: String(openCount) })}</Link></div>
          <div className="cb">
            <div className="filter-row">
              <button type="button" className={`filter-btn${dept === "all" ? " active" : ""}`} onClick={() => setDept("all")}>{t.filterAll}</button>
              {deptNames.map((name) => <button key={name} type="button" className={`filter-btn${dept === name ? " active" : ""}`} onClick={() => setDept(name)}>{name}</button>)}
            </div>
            {shown.length ? shown.map((item) => {
              const tag = prio(item, t);
              const done = item.status === "done";
              return <div key={item.id} className="todo">
                <button type="button" className={`todo-cb${done ? " done" : ""}`} aria-label={done ? t.reopen : t.markDone} onClick={() => void toggleTask(item.id)}>{done ? "✓" : ""}</button>
                <Link href={`/tasks/${item.id}`} className={`todo-t${done ? " done" : ""}`}>{item.title}</Link>
                <div className="todo-dept">{item.assignee}</div>
                <span className={`chip ${tag.chip}`}>{tag.label}</span>
              </div>;
            }) : <div style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.emptyTasks}</div>}
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">{t.periodic}</div></div>
          <div className="cb">
            {periodic.length ? periodic.map((item) => {
              const done = item.items.length > 0 && item.items.every((row) => row.state === "done");
              return <Link key={item.id} href={`/tasks/checklists/${item.id}`} className="todo" style={{ textDecoration: "none", color: "inherit" }}>
                <div className={`todo-cb${done ? " done" : ""}`}>{done ? "✓" : ""}</div>
                <div className={`todo-t${done ? " done" : ""}`}>{item.title}</div>
                <div className="todo-dept">{item.nextDue}</div>
                <span className={`chip ${done ? "chip-g" : "chip-a"}`}>{done ? "✓" : t.open}</span>
              </Link>;
            }) : <div style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.emptyChecklists}</div>}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {canManage ? <div className="card">
          <div className="ch"><div className="ct">{t.weekCard}</div></div>
          <div className="cb">
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{t.weekDone}</span><span style={{ fontWeight: 600 }}>{doneWeek}/{totalWeek}</span></div>
              <div className="progress-bar"><div className="progress-fill bar-g" style={{ width: `${pct || 0}%` }} /></div>
            </div>
            {weekBars.map((item, index) => {
              const bars = ["bar-g", "bar-a", "bar-r"];
              const width = item.total ? Math.round((item.done / item.total) * 100) : 0;
              return <div key={item.name} style={{ marginBottom: index === weekBars.length - 1 ? 0 : 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{item.name}</span><span style={{ fontWeight: 600 }}>{item.done}/{item.total}</span></div>
                <div className="progress-bar"><div className={`progress-fill ${bars[index % bars.length]}`} style={{ width: `${width}%` }} /></div>
              </div>;
            })}
          </div>
        </div> : null}
        {canManage ? <div className="card">
          <div className="ch"><div className="ct">{t.aiCreate}</div></div>
          <div className="cb">
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 12 }}>{t.aiCreateHint}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {templates.map((item) => <Link key={item.id} href={`/tasks/checklists/new?template=${item.id}`} className="btn btn-ghost" style={{ justifyContent: "flex-start" }}>📋 {item.title}</Link>)}
              <Link href="/tasks/checklists/new?kind=template" className="btn btn-primary" style={{ justifyContent: "flex-start" }}>{t.ownTemplate}</Link>
            </div>
          </div>
        </div> : null}
      </div>
    </div>
  </Shell>;
}

export function TasksListPage() {
  const t = useT();
  const router = useRouter();
  const { tasks, canManage, ready } = useTasks();
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  if (!ready) return <Shell title={t.pageTitle}><BrandLoader label={t.loading} /></Shell>;
  const rows = tasks.filter((item) => filter === "all" || item.status === filter);
  return <Shell title={t.pageTitle}>
    <div className="filter-row" style={{ marginBottom: 18 }}>
      <Link href="/tasks" className="filter-btn" style={{ padding: "8px 16px", fontSize: 13 }}>{t.tabToday}</Link>
      <Link href="/tasks/list" className="filter-btn active" style={{ padding: "8px 16px", fontSize: 13 }}>{t.tabTasks}</Link>
      <Link href="/tasks/checklists" className="filter-btn" style={{ padding: "8px 16px", fontSize: 13 }}>{t.tabChecklists}</Link>
    </div>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div className="filter-row" style={{ marginBottom: 0 }}>
        {([["all", t.filterAll], ["open", t.filterOpen], ["done", t.filterDone]] as const).map(([id, label]) => (
          <button key={id} type="button" className={`filter-btn${filter === id ? " active" : ""}`} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      {canManage ? <Link href="/tasks/new" className="btn btn-primary" style={{ marginLeft: "auto" }}>{t.createPlus}</Link> : null}
    </div>
    <div className="card" style={{ overflowX: "auto" }}>
      <table className="bud-table" style={{ width: "100%" }}>
        <thead><tr><th>{t.colTitle}</th><th>{t.colAssignee}</th><th>{t.colDue}</th><th>{t.colStatus}</th>{canManage ? <th style={{ textAlign: "right" }}>{t.colActions}</th> : null}</tr></thead>
        <tbody>
          {rows.length ? rows.map((item) => (
            <tr key={item.id} onClick={() => router.push(`/tasks/${item.id}`)} style={{ cursor: "pointer" }}>
              <td>{item.title}</td>
              <td>{item.assignee}</td>
              <td>{item.due || "–"}</td>
              <td><span className={`chip ${item.status === "done" ? "chip-g" : "chip-a"}`}>{item.status === "done" ? t.statusDone : t.statusOpen}</span></td>
              {canManage ? <td style={{ textAlign: "right" }}><Link href={`/tasks/${item.id}/edit`} className="icon-btn" onClick={(event) => event.stopPropagation()}>✏️</Link></td> : null}
            </tr>
          )) : <tr><td colSpan={canManage ? 5 : 4} style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.emptyTasks}</td></tr>}
        </tbody>
      </table>
    </div>
  </Shell>;
}

export function TaskFormPage({ id }: { id?: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const { tasks, departments, users, ready, saveTask } = useTasks();
  const existing = id ? tasks.find((item) => item.id === id) : undefined;
  const [title, setTitle] = useState("");
  const [assignType, setAssignType] = useState<"dept" | "person">("dept");
  const [departmentId, setDepartmentId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueIso, setDueIso] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setAssignType(existing.assignType);
      setDepartmentId(existing.departmentId);
      setAssigneeId(existing.assigneeId);
      setDueIso(existing.dueIso);
      setNote(existing.note);
      return;
    }
    setDepartmentId((prev) => prev || departments[0]?.id || "");
    setAssigneeId((prev) => prev || users[0]?.id || "");
  }, [departments, existing, users]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) { toast({ message: t.titleRequired, tone: "error" }); return; }
    setBusy(true);
    const nextId = await saveTask(id, { title, assignType, departmentId, assigneeId, dueIso, note });
    setBusy(false);
    if (!nextId) { toast({ message: t.saveFailed, tone: "error" }); return; }
    toast({ message: id ? t.savedEdit : t.saved, tone: "success" });
    router.push("/tasks/list");
  }

  if (!ready) return <Shell title={id ? t.editTask : t.createTask}><BrandLoader label={t.loading} /></Shell>;
  return <Shell title={id ? t.editTask : t.createTask}>
    {busy ? <BrandLoader label={t.translating} overlay /> : null}
    <Link href="/tasks/list" className="back-link">{t.backTasks}</Link>
    <form className="card" style={{ maxWidth: 460 }} onSubmit={onSubmit}>
      <div className="ch"><div className="ct">{id ? t.editTask : t.createTask}</div></div>
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div><label className="field-lbl">{t.title}</label><input className="field-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.titlePlaceholder} /></div>
        <div style={{ display: "flex", gap: 14 }}>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="radio" checked={assignType === "dept"} onChange={() => setAssignType("dept")} /> {t.assignDept}</label>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="radio" checked={assignType === "person"} onChange={() => setAssignType("person")} /> {t.assignPerson}</label>
        </div>
        {assignType === "dept"
          ? <select className="field-select" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          : <select className="field-select" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>{users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        <div><label className="field-lbl">{t.due}</label><input className="field-input" type="date" value={dueIso} onChange={(event) => setDueIso(event.target.value)} /></div>
        <div><label className="field-lbl">{t.note}</label><input className="field-input" value={note} onChange={(event) => setNote(event.target.value)} placeholder={t.noteOptional} /></div>
        <button className="btn btn-primary" type="submit" disabled={busy}>{t.save}</button>
      </div>
    </form>
  </Shell>;
}

export function TaskDetailPage({ id }: { id: string }) {
  const t = useT();
  const toast = useToast();
  const { tasks, canManage, ready, toggleTask } = useTasks();
  const [busy, setBusy] = useState(false);
  const item = tasks.find((row) => row.id === id);
  if (!ready) return <Shell title={t.pageTitle}><BrandLoader label={t.loading} /></Shell>;
  if (!item) return <Shell title={t.pageTitle}><Link href="/tasks/list" className="back-link">{t.backTasks}</Link><div className="card" style={{ maxWidth: 460 }}><div className="cb">{t.emptyTasks}</div></div></Shell>;

  async function toggle() {
    setBusy(true);
    const ok = await toggleTask(id);
    setBusy(false);
    if (!ok) toast({ message: t.saveFailed, tone: "error" });
  }

  return <Shell title={item.title}>
    <Link href="/tasks/list" className="back-link">{t.backTasks}</Link>
    <div className="card" style={{ maxWidth: 460 }}>
      <div className="ch"><div className="ct">{item.title}</div><span className={`status-pill ${item.status === "open" ? "active" : "inactive"}`}>{item.status === "open" ? t.statusOpen : t.statusDone}</span></div>
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
        <div><span style={{ color: "var(--text3)" }}>{t.responsible}</span> {item.assignee || "–"}</div>
        <div><span style={{ color: "var(--text3)" }}>{t.dueLabel}</span> {item.due || "–"}</div>
        <div><span style={{ color: "var(--text3)" }}>{t.noteLabel}</span> {item.note || "–"}</div>
        {item.origin ? <div style={{ fontSize: 11.5, color: "var(--accent)" }}>{item.origin}</div> : null}
        {item.status === "done" && item.completedAt ? <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 4 }}>{t.completedMeta.replace("{when}", item.completedAt).replace("{name}", item.completedBy || "–")}</div> : null}
      </div>
      <div className="cb" style={{ borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void toggle()}>{item.status === "done" ? t.reopen : t.markDone}</button>
        {canManage ? <Link href={`/tasks/${id}/edit`} className="btn btn-ghost">{t.edit}</Link> : null}
      </div>
    </div>
  </Shell>;
}

export function ChecklistsListPage() {
  const t = useT();
  const router = useRouter();
  const { checklists, canManage, ready, setChecklistStatus } = useTasks();
  const [filter, setFilter] = useState<"all" | "active" | "draft" | "archived">("all");
  const [query, setQuery] = useState("");
  if (!ready) return <Shell title={t.listTitle}><BrandLoader label={t.loading} /></Shell>;
  const rows = checklists.filter((item) => {
    if (item.kind !== "checklist") return false;
    if (item.origin === "run") return !item.completedAt && (filter === "all" || filter === "active") && (!query || item.title.toLowerCase().includes(query.toLowerCase()));
    const statusOk = filter === "all" || (filter === "active" ? item.status === "active" && !item.completedAt : item.status === filter);
    return statusOk && (!query || item.title.toLowerCase().includes(query.toLowerCase()));
  });
  function openRow(item: PublicChecklist) {
    router.push(`/tasks/checklists/${item.id}`);
  }
  return <Shell title={t.listTitle}>
    <Link href="/tasks" className="back-link">{t.backTasks}</Link>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div className="filter-row" style={{ marginBottom: 0 }}>
        {([["all", t.filterAll], ["active", t.filterActive], ...(canManage ? [["draft", t.filterDraft], ["archived", t.filterArchived]] as const : [])] as const).map(([id, label]) => (
          <button key={id} type="button" className={`filter-btn${filter === id ? " active" : ""}`} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>
      <input className="field-input" style={{ maxWidth: 220 }} placeholder={t.search} value={query} onChange={(event) => setQuery(event.target.value)} />
      {canManage ? <Link href="/tasks/checklists/new" className="btn btn-primary" style={{ marginLeft: "auto" }}>{t.createChecklist}</Link> : null}
    </div>
    <div className="card" style={{ overflowX: "auto" }}>
      <table className="bud-table" style={{ width: "100%" }}>
        <thead><tr><th>{t.colTitle}</th><th>{t.colAssignee}</th><th>{t.colRepeat}</th><th>{t.colNext}</th><th>{t.colStatus}</th>{canManage ? <th style={{ textAlign: "right" }}>{t.colActions}</th> : null}</tr></thead>
        <tbody>
          {rows.length ? rows.map((item) => (
            <tr key={item.id} onClick={() => openRow(item)} style={{ cursor: "pointer" }}>
              <td>{item.title}</td>
              <td>{item.assignType === "all" ? t.everyone : item.assignee || "–"}</td>
              <td>{recurrenceLabel(item, t)}</td>
              <td>{item.nextDue || "–"}</td>
              <td><span className={`chip ${item.completedAt ? "chip-g" : statusChip(item.status)}`}>{item.completedAt ? t.statusDone : statusLabel(item.status, t)}</span></td>
              {canManage ? <td style={{ textAlign: "right", whiteSpace: "nowrap" }} onClick={(event) => event.stopPropagation()}>
                {item.origin === "original" ? <>
                  <button
                    type="button"
                    className="icon-btn"
                    title={item.status === "active" ? t.setArchived : t.setActive}
                    onClick={() => void setChecklistStatus(item.id, item.status === "active" ? "archived" : "active")}
                  >{item.status === "active" ? "🗄️" : "↩️"}</button>
                  <Link href={`/tasks/checklists/${item.id}/edit`} className="icon-btn" style={{ marginLeft: 6 }}>✏️</Link>
                </> : null}
              </td> : null}
            </tr>
          )) : <tr><td colSpan={canManage ? 6 : 5} style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.emptyChecklists}</td></tr>}
        </tbody>
      </table>
    </div>
  </Shell>;
}

export function ChecklistFormPage({ id }: { id?: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const search = useSearchParams();
  const { checklists, templates, departments, users, ready, saveChecklist } = useTasks();
  const existing = id ? checklists.find((item) => item.id === id) || templates.find((item) => item.id === id) : undefined;
  const templateId = search.get("template") ?? "";
  const asTemplate = search.get("kind") === "template";
  const source = existing || templates.find((item) => item.id === templateId);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [itemInput, setItemInput] = useState("");
  const [assignType, setAssignType] = useState<"all" | "dept" | "person">("all");
  const [departmentId, setDepartmentId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueType, setDueType] = useState<"once" | "recurring">("once");
  const [recurrence, setRecurrence] = useState("weekly");
  const [weekdays, setWeekdays] = useState<string[]>([]);
  const [dueIso, setDueIso] = useState("");
  const [startIso, setStartIso] = useState("");
  const [endIso, setEndIso] = useState("");
  const [noEnd, setNoEnd] = useState(true);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState("");

  function fillFrom(selected: PublicChecklist) {
    setTitle(selected.title);
    setDesc(selected.desc);
    setItems(selected.items.map((row) => row.text));
    setAssignType(selected.assignType);
    setDepartmentId(selected.departmentId || departments[0]?.id || "");
    setAssigneeId(selected.assigneeId || users[0]?.id || "");
    setDueType(selected.dueType);
    setRecurrence(selected.recurrence === "once" ? "weekly" : selected.recurrence);
    setWeekdays(selected.weekdays ?? []);
    setDueIso(selected.dueIso);
    setStartIso(selected.startIso);
    setEndIso(selected.endIso);
    setNoEnd(!selected.endIso);
  }

  useEffect(() => {
    if (source) {
      fillFrom(source);
      if (templateId) setPicked(templateId);
      return;
    }
    setDepartmentId((prev) => prev || departments[0]?.id || "");
    setAssigneeId((prev) => prev || users[0]?.id || "");
  }, [departments, source, templateId, users]);

  function addItem() {
    const value = itemInput.trim();
    if (!value) return;
    setItems([...items, value]);
    setItemInput("");
  }

  function applyTemplate(value: string) {
    setPicked(value);
    const selected = templates.find((item) => item.id === value);
    if (!selected) return;
    fillFrom(selected);
  }

  async function save(status: "active" | "draft", kind: "checklist" | "template") {
    if (!title.trim()) { toast({ message: t.titleRequired, tone: "error" }); return; }
    setBusy(true);
    const nextId = await saveChecklist(id && !asTemplate ? id : undefined, {
      title, desc, items, assignType, departmentId, assigneeId, dueType, recurrence: recurrence as PublicChecklist["recurrence"], weekdays, dueIso, startIso, endIso, noEnd, status, kind,
    });
    setBusy(false);
    if (!nextId) { toast({ message: t.checklistSaveFailed, tone: "error" }); return; }
    toast({ message: t.checklistSaved, tone: "success" });
    if (kind === "template") router.push("/tasks");
    else router.push(`/tasks/checklists/${nextId}`);
  }

  function onKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") { event.preventDefault(); addItem(); }
  }

  if (!ready) return <Shell title={t.createChecklist}><BrandLoader label={t.loading} /></Shell>;
  return <Shell title={t.createChecklist}>
    {busy ? <BrandLoader label={t.translating} overlay /> : null}
    <Link href="/tasks/checklists" className="back-link">{t.backChecklists}</Link>
    <div className="g2">
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch">
            <div className="ct">{t.content}</div>
            <select className="field-select" style={{ maxWidth: 220 }} value={picked} onChange={(event) => applyTemplate(event.target.value)}>
              <option value="">{t.chooseTemplate}</option>
              {templates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </div>
          <div className="cb">
            <label className="field-lbl">{t.title}</label>
            <input className="field-input" style={{ marginBottom: 14 }} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.titlePlaceholder} />
            <label className="field-lbl">{t.desc}</label>
            <textarea className="field-input" style={{ minHeight: 100, resize: "vertical", lineHeight: 1.6, marginBottom: 16 }} value={desc} onChange={(event) => setDesc(event.target.value)} placeholder={t.descPlaceholder} />
            <div style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 16 }}>{t.autoTranslate}</div>
            <label className="field-lbl">{t.points}</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
              {items.map((item, index) => (
                <div key={`${item}-${index}`} className="doc-row" style={{ padding: "8px 10px" }}>
                  <div className="doc-ic" style={{ width: 26, height: 26, fontSize: 12 }}>{index + 1}</div>
                  <div className="doc-name">{item}</div>
                  <button type="button" className="icon-btn danger" onClick={() => setItems(items.filter((_, i) => i !== index))}>🗑️</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="field-input" value={itemInput} onChange={(event) => setItemInput(event.target.value)} placeholder={t.newPoint} onKeyDown={onKey} />
              <button type="button" className="btn btn-ghost" onClick={addItem}>{t.add}</button>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><div className="ct">{t.assignCard}</div></div>
          <div className="cb">
            <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
              <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="radio" checked={assignType === "all"} onChange={() => setAssignType("all")} /> {t.assignAll}</label>
              <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="radio" checked={assignType === "dept"} onChange={() => setAssignType("dept")} /> {t.assignDept}</label>
              <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="radio" checked={assignType === "person"} onChange={() => setAssignType("person")} /> {t.assignPerson}</label>
            </div>
            {assignType === "dept" ? <select className="field-select" style={{ marginBottom: 0 }} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : null}
            {assignType === "person" ? <select className="field-select" style={{ marginBottom: 0 }} value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}>{users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select> : null}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><div className="ct">{t.dueCard}</div></div>
          <div className="cb">
            <div style={{ display: "flex", gap: 14, marginBottom: 12 }}>
              <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="radio" checked={dueType === "once"} onChange={() => setDueType("once")} /> {t.once}</label>
              <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="radio" checked={dueType === "recurring"} onChange={() => setDueType("recurring")} /> {t.recurring}</label>
            </div>
            {dueType === "once" ? <>
              <label className="field-lbl">{t.due}</label>
              <input className="field-input" type="date" value={dueIso} onChange={(event) => setDueIso(event.target.value)} />
            </> : <>
              <label className="field-lbl">{t.rhythm}</label>
              <select className="field-select" style={{ marginBottom: 10 }} value={recurrence} onChange={(event) => setRecurrence(event.target.value)}>
                <option value="daily">{t.daily}</option>
                <option value="weekly">{t.weekly}</option>
                <option value="monthly">{t.monthly}</option>
                <option value="quarterly">{t.quarterly}</option>
                <option value="yearly">{t.yearly}</option>
              </select>
              {recurrence === "weekly" ? <div style={{ marginBottom: 10 }}>
                <label className="field-lbl">{t.weekdays}</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {WEEKDAYS.map((day) => (
                    <label key={day} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                      <input type="checkbox" checked={weekdays.includes(day)} onChange={() => setWeekdays(weekdays.includes(day) ? weekdays.filter((item) => item !== day) : [...weekdays, day])} />
                      {weekdayLabel(day, t)}
                    </label>
                  ))}
                </div>
              </div> : null}
              <label className="field-lbl">{t.start}</label>
              <input className="field-input" type="date" style={{ marginBottom: 10 }} value={startIso} onChange={(event) => setStartIso(event.target.value)} />
              <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginBottom: 8 }}>
                <input type="checkbox" checked={noEnd} onChange={() => setNoEnd(!noEnd)} /> {t.noEnd}
              </label>
              {!noEnd ? <><label className="field-lbl">{t.end}</label><input className="field-input" type="date" value={endIso} onChange={(event) => setEndIso(event.target.value)} /></> : null}
            </>}
          </div>
        </div>
        <div className="card">
          <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save("active", asTemplate ? "template" : "checklist")}>{t.save}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void save("draft", "checklist")}>{t.saveDraft}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void save("active", "template")}>{t.saveTemplate}</button>
          </div>
        </div>
      </div>
    </div>
  </Shell>;
}

export function ChecklistDetailPage({ id }: { id: string }) {
  const t = useT();
  const toast = useToast();
  const { checklists, templates, canManage, ready, toggleItem, completeChecklist } = useTasks();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const item = checklists.find((row) => row.id === id) || templates.find((row) => row.id === id);
  if (!ready) return <Shell title={t.listTitle}><BrandLoader label={t.loading} /></Shell>;
  if (!item) return <Shell title={t.listTitle}><Link href="/tasks/checklists" className="back-link">{t.backChecklists}</Link><div className="card"><div className="cb">{t.emptyChecklists}</div></div></Shell>;
  const canComplete = item.kind === "checklist" && !item.completedAt;

  async function toggle(itemId: string) {
    if (!canComplete) return;
    await toggleItem(id, itemId);
  }

  async function complete() {
    setBusy(true);
    const ok = await completeChecklist(id, comment);
    setBusy(false);
    if (!ok) toast({ message: t.checklistSaveFailed, tone: "error" });
  }

  return <Shell title={item.title}>
    <Link href="/tasks/checklists" className="back-link">{t.backChecklists}</Link>
    <div className="g2">
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch">
            <div>
              <div className="ct">{item.title}</div>
              <div style={{ fontSize: 11.5, color: "var(--text2)", fontWeight: 400, marginTop: 2 }}>
                {item.assignType === "all" ? t.everyone : item.assignee} · {recurrenceLabel(item, t)} · {item.nextDue || "–"}
              </div>
              {item.assignType !== "person" && !item.completedAt ? <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 400, marginTop: 6 }}>{item.assignType === "dept" ? fill(t.sharedDept, { name: item.assignee || t.assignDept }) : t.sharedAll}</div> : null}
            </div>
            <span className={`status-pill ${item.status === "active" ? "active" : "inactive"}`}>{item.completedAt ? t.statusDone : statusLabel(item.status, t)}</span>
          </div>
          <div className="cb">
            <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 14, lineHeight: 1.6 }}>{item.desc}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {item.items.map((row) => (
                <button key={row.id} type="button" className="todo" style={{ width: "100%", background: "none", border: 0, textAlign: "left", font: "inherit", color: "inherit", cursor: canComplete ? "pointer" : "default" }} onClick={() => void toggle(row.id)}>
                  <div className={`todo-cb${row.state === "done" ? " done" : row.state === "exception" ? " exception" : ""}`}>{row.state === "done" ? "✓" : row.state === "exception" ? "!" : ""}</div>
                  <div className={`todo-t${row.state === "done" ? " done" : ""}`}>{row.text}</div>
                </button>
              ))}
            </div>
            {item.completedAt ? <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 12 }}>{t.completedMeta.replace("{when}", item.completedAt).replace("{name}", item.completedBy || "–")}</div> : null}
          </div>
          {canComplete ? <>
            <div className="cb" style={{ borderTop: "1px solid var(--border)" }}>
              <label className="field-lbl" style={{ marginBottom: 6 }}>{t.comment}</label>
              <textarea className="field-input" style={{ minHeight: 60, resize: "vertical" }} value={comment} onChange={(event) => setComment(event.target.value)} />
            </div>
            <div className="cb" style={{ borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void complete()}>{t.complete}</button>
              {canManage && item.origin === "original" ? <Link href={`/tasks/checklists/${id}/edit`} className="btn btn-ghost">{t.edit}</Link> : null}
            </div>
          </> : canManage && item.origin === "original" ? <div className="cb" style={{ borderTop: "1px solid var(--border)" }}><Link href={`/tasks/checklists/${id}/edit`} className="btn btn-ghost">{t.edit}</Link></div> : null}
        </div>
      </div>
      <div>
        <div className="card">
          <div className="ch"><div className="ct">{t.history}</div></div>
          <div className="cb">
            {item.completions.length ? item.completions.map((row) => (
              <div key={row.id} className="todo">
                <div className="todo-cb done">✓</div>
                <div className="todo-t">{row.author}</div>
                <div className="todo-dept">{row.date}</div>
              </div>
            )) : <div style={{ fontSize: 12, color: "var(--text3)" }}>{t.noHistory}</div>}
          </div>
          <div className="cb" style={{ borderTop: "1px solid var(--border)" }}>
            <Link href="/settings/activity-log" style={{ color: "var(--accent)", fontSize: 12, fontWeight: 600 }}>{t.fullLog}</Link>
          </div>
        </div>
      </div>
    </div>
  </Shell>;
}
