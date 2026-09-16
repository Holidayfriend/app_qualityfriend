"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { getScheduleMessages, type ScheduleMessages } from "../../lib/i18n/schedule-messages";
import { DEPT_HOURS, type AbsenceCategory, type AbsenceStatus, type Employee, type ShiftKey } from "../../lib/schedule/demo-data";
import { useSchedule } from "./schedule-provider";

type T = ScheduleMessages;
type Tab = "plan" | "own" | "absence" | "stats";

function fill(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function useT() {
  const { locale } = useI18n();
  return getScheduleMessages(locale);
}

function templateLabel(name: string, t: T) {
  if (name === "early") return t.early;
  if (name === "mid") return t.mid;
  if (name === "late") return t.late;
  return name;
}

function shiftMeta(key: ShiftKey, t: T) {
  if (key === "f") return { label: "07–15", cls: "dp-f" };
  if (key === "m") return { label: "11–19", cls: "dp-m" };
  if (key === "s") return { label: "17–23", cls: "dp-s" };
  if (key === "off") return { label: t.shiftOff, cls: "dp-off" };
  if (key === "vac") return { label: t.shiftVac, cls: "dp-vac" };
  if (key === "open") return { label: t.shiftOpen, cls: "dp-open" };
  return { label: "09–18", cls: "dp-k" };
}

function categoryLabel(category: AbsenceCategory, t: T) {
  if (category === "sick") return t.catSick;
  if (category === "swap") return t.catSwap;
  return t.catVacation;
}

function statusMeta(status: AbsenceStatus, t: T) {
  if (status === "approved") return { label: t.statusApproved, cls: "chip-g" };
  if (status === "rejected") return { label: t.statusRejected, cls: "chip-r" };
  return { label: t.statusOpen, cls: "chip-a" };
}

function Shell({ title, children, tabs }: { title: string; children: ReactNode; tabs?: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const { isPlanner } = useSchedule();
  const tab: Tab = pathname.startsWith("/schedule/stats") ? "stats" : pathname.startsWith("/schedule/absences") ? "absence" : pathname.startsWith("/schedule/own") ? "own" : "plan";
  const items = [
    ...(isPlanner ? [["/schedule", t.tabPlan, "plan"] as const] : []),
    ["/schedule/own", t.tabOwn, "own"] as const,
    ["/schedule/absences", t.tabAbsence, "absence"] as const,
    ...(isPlanner ? [["/schedule/stats", t.tabStats, "stats"] as const] : []),
  ];
  return <AppShell activeItem="schedule" pageTitle={title}>
    <main className="qf-dashboard pb-24 lg:pb-[24px]">
      {tabs ? <nav className="hk-tabs">{items.map(([href, label, id]) => <Link key={id} href={href} className={`hk-tab${tab === id ? " active" : ""}`}>{label}</Link>)}</nav> : null}
      {children}
    </main>
  </AppShell>;
}

export function SchedulePlanPage() {
  const t = useT();
  const router = useRouter();
  const { isPlanner, employees } = useSchedule();
  const [deptFilter, setDeptFilter] = useState("all");
  const visible = employees.filter((emp) => deptFilter === "all" || emp.dept === deptFilter);

  function copyWeek() {
    const target = window.prompt(t.copyPrompt, t.copyPromptValue);
    if (!target) return;
    window.alert(fill(t.copyDone, { target }));
  }

  function exportPlan() {
    const format = window.prompt(t.exportPrompt, "pdf");
    if (!format) return;
    window.alert(fill(t.exportDone, { format: format.toUpperCase() }));
  }

  if (!isPlanner) {
    router.replace("/schedule/own");
    return <Shell title={t.pageTitle} tabs><p style={{ fontSize: 13, color: "var(--text2)" }}>{t.tabOwn}</p></Shell>;
  }

  return <Shell title={t.pageTitle} tabs>
    <div className="kpi-row" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
      <div className="kpi"><div className="kpi-lbl">{t.kpiStaffWeek}</div><div className="kpi-val">8</div><div className="kpi-sub">{t.kpiStaffSub}</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiHours}</div><div className="kpi-val">312<span>{t.hoursUnit}</span></div><div className="kpi-sub"><span className="chip chip-g">{t.kpiHoursChip}</span></div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiOpenShifts}</div><div className="kpi-val" style={{ color: "var(--amber)" }}>1</div><div className="kpi-sub"><span className="chip chip-a">{t.kpiOpenChip}</span></div></div>
    </div>
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="ch" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="ct">{t.weekPlan}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => window.alert(t.alertPrevWeek)}>{t.prevWeek}</button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => window.alert(t.alertNextWeek)}>{t.nextWeek}</button>
          <select className="field-select" style={{ marginBottom: 0, padding: "6px 10px", fontSize: 12, width: "auto" }} value={deptFilter} onChange={(event) => setDeptFilter(event.target.value)}>
            <option value="all">{t.allDepartments}</option>
            <option value="reception">{t.depts.reception}</option>
            <option value="housekeeping">{t.depts.housekeeping}</option>
            <option value="restaurant">{t.depts.restaurant}</option>
            <option value="management">{t.depts.management}</option>
          </select>
          <Link href="/schedule/templates" className="btn btn-ghost" style={{ fontSize: 12 }}>{t.templatesBtn}</Link>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={copyWeek}>{t.copyWeek}</button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => window.print()}>{t.print}</button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={exportPlan}>{t.export}</button>
          <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => window.alert(t.alertPublish)}>{t.publish}</button>
        </div>
      </div>
      <div className="cb" style={{ overflowX: "auto" }}>
        <div className="dp-grid">
          <div className="dp-head" style={{ textAlign: "left" }}>{t.employeeCol}</div>
          {t.days.map((day) => <div key={day} className="dp-head">{day}</div>)}
          {visible.map((emp) => <EmployeeRow key={emp.key} emp={emp} t={t} />)}
        </div>
      </div>
    </div>
    <div style={{ padding: "12px 16px", background: "var(--amber-bg)", border: "1px solid #FDE68A", borderRadius: 8, fontSize: 13.5, color: "var(--amber)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      ⚠️ <strong>{t.alertOpenStrong}</strong>{t.alertOpenBody}
      <button type="button" className="btn" style={{ marginLeft: "auto", background: "var(--amber)", color: "#fff", fontSize: 12, padding: "5px 12px" }} onClick={() => window.alert(t.alertAi)}>{t.aiSuggest}</button>
    </div>
  </Shell>;
}

function EmployeeRow({ emp, t }: { emp: Employee; t: T }) {
  return <>
    <div className="dp-name">{emp.name}<div className="dp-dept">{t.depts[emp.dept]}</div></div>
    {emp.shifts.map((shift, index) => {
      const meta = shiftMeta(shift, t);
      return <Link key={`${emp.key}-${index}`} href={`/schedule/shift?employee=${emp.key}&day=${index}`} className="dp-cell"><div className={`dp-shift ${meta.cls}`}>{meta.label}</div></Link>;
    })}
  </>;
}

export function ScheduleOwnPage() {
  const t = useT();
  const { fullName, employees } = useSchedule();
  const own = employees.find((item) => item.key === "klaus") ?? employees[0];
  return <Shell title={t.pageTitle} tabs>
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="ch">
        <div className="ct">{fill(t.ownWeek, { name: fullName || own.name })}</div>
        <Link href="/schedule/request" className="btn btn-primary" style={{ fontSize: 12 }}>{t.requestBtn}</Link>
      </div>
      <div className="cb">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
          {t.days.map((day, index) => {
            const meta = shiftMeta(own.shifts[index], t);
            return <div key={day} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, marginBottom: 6 }}>{day}</div>
              <div className={`dp-shift ${meta.cls}`}>{meta.label}</div>
            </div>;
          })}
        </div>
      </div>
    </section>
  </Shell>;
}

export function ScheduleAbsencesPage() {
  const t = useT();
  const { isPlanner, absences, setAbsences, decideAbsence, employees } = useSchedule();
  const [filter, setFilter] = useState<"all" | AbsenceStatus>("all");
  const own = employees.find((item) => item.key === "klaus") ?? employees[0];
  const rows = absences.filter((item) => filter === "all" || item.status === filter);
  return <Shell title={t.pageTitle} tabs>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div className="filter-row" style={{ marginBottom: 0 }}>
        {([["all", t.filterAll], ["open", t.filterOpen], ["approved", t.filterApproved], ["rejected", t.filterRejected]] as const).map(([id, label]) =>
          <button key={id} type="button" className={`filter-btn${filter === id ? " active" : ""}`} onClick={() => setFilter(id)}>{label}</button>)}
      </div>
      <Link href={`/schedule/request?employee=${own.key}`} className="btn btn-primary" style={{ marginLeft: "auto" }}>{t.addAbsence}</Link>
    </div>
    <div className="card">
      <table className="bud-table" style={{ width: "100%" }}>
        <thead><tr><th>{t.colEmployee}</th><th>{t.colCategory}</th><th>{t.colPeriod}</th><th>{t.colNote}</th><th>{t.colStatus}</th><th style={{ textAlign: "right" }}>{t.colActions}</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((item) => {
            const index = absences.indexOf(item);
            const status = statusMeta(item.status, t);
            return <tr key={`${item.empKey}-${item.start}-${index}`}>
              <td>{item.employee}</td>
              <td>{categoryLabel(item.category, t)}</td>
              <td>{item.start}{item.end !== item.start ? ` ${t.dash} ${item.end}` : ""}</td>
              <td>{item.note || t.dash}</td>
              <td><span className={`chip ${status.cls}`}>{status.label}</span></td>
              <td style={{ textAlign: "right" }}>{isPlanner ? item.status === "open"
                ? <><button type="button" className="icon-btn" onClick={() => decideAbsence(index, "approved")}>✅</button> <button type="button" className="icon-btn danger" onClick={() => decideAbsence(index, "rejected")}>✖️</button></>
                : <button type="button" className="icon-btn danger" onClick={() => setAbsences((current) => current.filter((_, i) => i !== index))}>🗑️</button>
              : t.dash}</td>
            </tr>;
          }) : <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text3)", padding: 20 }}>{t.empty}</td></tr>}
        </tbody>
      </table>
    </div>
  </Shell>;
}

export function ScheduleStatsPage() {
  const t = useT();
  const router = useRouter();
  const { isPlanner } = useSchedule();
  if (!isPlanner) {
    router.replace("/schedule/own");
    return <Shell title={t.pageTitle} tabs />;
  }
  return <Shell title={t.pageTitle} tabs>
    <div className="kpi-row" style={{ marginBottom: 18 }}>
      <div className="kpi"><div className="kpi-lbl">{t.kpiTotalHours}</div><div className="kpi-val">312<span>{t.hoursUnit}</span></div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiAvgHours}</div><div className="kpi-val">39<span>{t.hoursUnit}</span></div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiOvertime}</div><div className="kpi-val" style={{ color: "var(--amber)" }}>6<span>{t.hoursUnit}</span></div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiAbsenceDays}</div><div className="kpi-val">5<span>{t.daysUnit}</span></div></div>
    </div>
    <div className="card">
      <div className="ch"><div className="ct">{t.hoursByDept}</div></div>
      <div className="cb">
        {DEPT_HOURS.map((row, index) => <div key={row.dept} style={{ marginBottom: index === DEPT_HOURS.length - 1 ? 0 : 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{t.depts[row.dept]}</span><span>{row.hours}</span></div>
          <div className="progress-bar"><div className={`progress-fill ${row.bar}`} style={{ width: row.width }} /></div>
        </div>)}
      </div>
    </div>
  </Shell>;
}

export function ScheduleShiftPage({ employee, day }: { employee: string; day: number }) {
  const t = useT();
  const router = useRouter();
  const { employees, templates, saveShift } = useSchedule();
  const emp = employees.find((item) => item.key === employee) ?? employees[0];
  const [form, setForm] = useState({ template: "", start: "09:00", end: "17:00", pause: "", note: "", repeat: "none" });

  function applyTemplate(value: string) {
    setForm((current) => {
      if (value.startsWith("tpl_")) {
        const template = templates[Number(value.slice(4))];
        if (!template) return { ...current, template: value };
        return { ...current, template: value, start: template.start, end: template.end };
      }
      return { ...current, template: value };
    });
  }

  function save() {
    saveShift(emp.key, day, form.start, form.end, form.template);
    window.alert(form.repeat === "4weeks" ? t.savedRepeat4 : form.repeat === "month" ? t.savedRepeatMonth : t.saved);
    router.push("/schedule");
  }

  return <Shell title={t.shiftTitle}>
    <Link href="/schedule" className="back-link">{t.back}</Link>
    <section className="card" style={{ maxWidth: 460 }}>
      <div className="ch"><div className="ct">{emp.name} · {t.days[day] ?? t.days[0]}</div></div>
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div><label className="field-lbl">{t.presetShift}</label>
          <select className="field-select" value={form.template} onChange={(event) => applyTemplate(event.target.value)}>
            <option value="">{t.manual}</option>
            {templates.map((item, index) => <option key={`${item.name}-${index}`} value={`tpl_${index}`}>{templateLabel(item.name, t)} ({item.start}–{item.end})</option>)}
            <option value="off">{t.off}</option>
            <option value="vac">{t.vacation}</option>
          </select>
        </div>
        <div className="field-row">
          <div><label className="field-lbl">{t.start}</label><input className="field-input" type="time" value={form.start} onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))} /></div>
          <div><label className="field-lbl">{t.end}</label><input className="field-input" type="time" value={form.end} onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))} /></div>
        </div>
        <div><label className="field-lbl">{t.breakMins}</label><input className="field-input" type="number" placeholder="30" value={form.pause} onChange={(event) => setForm((current) => ({ ...current, pause: event.target.value }))} /></div>
        <div><label className="field-lbl">{t.note}</label><input className="field-input" placeholder={t.optional} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></div>
        <div><label className="field-lbl">{t.repeat}</label>
          <select className="field-select" value={form.repeat} onChange={(event) => setForm((current) => ({ ...current, repeat: event.target.value }))}>
            <option value="none">{t.repeatNone}</option>
            <option value="4weeks">{t.repeat4}</option>
            <option value="month">{t.repeatMonth}</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={save}>{t.save}</button>
          <Link href="/schedule" className="btn btn-ghost">{t.cancel}</Link>
        </div>
      </div>
    </section>
  </Shell>;
}

export function ScheduleTemplatesPage() {
  const t = useT();
  const { templates, setTemplates } = useSchedule();

  function addTemplate() {
    const name = window.prompt(t.tplNamePrompt, t.tplNameValue);
    if (!name) return;
    const start = window.prompt(t.tplStartPrompt, "23:00");
    if (!start) return;
    const end = window.prompt(t.tplEndPrompt, "07:00");
    if (!end) return;
    setTemplates((current) => [...current, { name, start, end }]);
  }

  return <Shell title={t.templatesTitle}>
    <Link href="/schedule" className="back-link">{t.back}</Link>
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}><button type="button" className="btn btn-primary" onClick={addTemplate}>{t.addTemplate}</button></div>
    {templates.length ? templates.map((item, index) => <div key={`${item.name}-${index}`} className="doc-row">
      <div className="doc-ic">🕐</div>
      <div style={{ flex: 1 }}><div className="doc-name">{templateLabel(item.name, t)}</div><div style={{ fontSize: 11, color: "var(--text3)" }}>{item.start} – {item.end}</div></div>
      <button type="button" className="icon-btn danger" onClick={() => setTemplates((current) => current.filter((_, i) => i !== index))}>🗑️</button>
    </div>) : <div style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.noTemplates}</div>}
  </Shell>;
}

export function ScheduleRequestPage({ employee }: { employee?: string }) {
  const t = useT();
  const router = useRouter();
  const { employees, isPlanner, setAbsences } = useSchedule();
  const [form, setForm] = useState({
    empKey: employee || "klaus",
    category: "vacation" as AbsenceCategory,
    start: "",
    end: "",
    note: "",
  });

  function save(event: FormEvent) {
    event.preventDefault();
    if (!form.start) {
      window.alert(t.needStart);
      return;
    }
    const emp = employees.find((item) => item.key === form.empKey);
    setAbsences((current) => [{
      employee: emp?.name ?? form.empKey,
      empKey: form.empKey,
      category: form.category,
      start: form.start,
      end: form.end || form.start,
      note: form.note,
      status: "open",
    }, ...current]);
    window.alert(t.requestSent);
    router.push(isPlanner ? "/schedule/absences" : "/schedule/own");
  }

  return <Shell title={t.requestTitle}>
    <Link href="/schedule" className="back-link">{t.back}</Link>
    <form className="card" style={{ maxWidth: 460 }} onSubmit={save}>
      <div className="ch"><div className="ct">{t.requestTitle}</div></div>
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div><label className="field-lbl">{t.employee}</label>
          <select className="field-select" value={form.empKey} onChange={(event) => setForm((current) => ({ ...current, empKey: event.target.value }))}>
            {employees.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
          </select>
        </div>
        <div><label className="field-lbl">{t.category}</label>
          <select className="field-select" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as AbsenceCategory }))}>
            <option value="vacation">{t.catVacation}</option>
            <option value="sick">{t.catSick}</option>
            <option value="swap">{t.catSwap}</option>
          </select>
        </div>
        <div className="field-row">
          <div><label className="field-lbl">{t.from}</label><input className="field-input" type="date" value={form.start} onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))} /></div>
          <div><label className="field-lbl">{t.to}</label><input className="field-input" type="date" value={form.end} onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))} /></div>
        </div>
        <div><label className="field-lbl">{t.note}</label><input className="field-input" placeholder={t.optional} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></div>
        <button type="submit" className="btn btn-primary">{t.sendRequest}</button>
      </div>
    </form>
  </Shell>;
}
