"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AppShell } from "../dashboard/app-shell";
import { BrandLoader } from "../ui/brand-loader";
import { useToast } from "../ui/toast-provider";
import { useI18n } from "../i18n/i18n-provider";
import { getScheduleMessages, type ScheduleMessages } from "../../lib/i18n/schedule-messages";
import { type AbsenceCategory, type AbsenceStatus, type Employee, type ShiftCell } from "../../lib/schedule/demo-data";
import { formatDayHeader, formatWeekRange } from "../../lib/schedule/week";
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

function shiftMeta(cell: ShiftCell | undefined, t: T) {
  if (!cell || cell.kind === "empty") return { label: t.dash, cls: "dp-off" };
  if (cell.kind === "off") return { label: t.shiftOff, cls: "dp-off" };
  if (cell.kind === "vac") return { label: t.shiftVac, cls: "dp-vac" };
  const start = cell.start.slice(0, 5);
  const end = cell.end.slice(0, 5);
  const cls = start <= "08:00" ? "dp-f" : start <= "13:00" ? "dp-m" : "dp-s";
  return { label: start && end ? `${start}–${end}` : t.dash, cls };
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
  const items = isPlanner ? [
    ["/schedule", t.tabPlan, "plan"] as const,
    ["/schedule/own", t.tabOwn, "own"] as const,
    ["/schedule/absences", t.tabAbsence, "absence"] as const,
    ["/schedule/stats", t.tabStats, "stats"] as const,
  ] : [
    ["/schedule/own", t.tabOwn, "own"] as const,
  ];
  return <AppShell activeItem="schedule" pageTitle={title}>
    <main className="qf-dashboard pb-24 lg:pb-[24px]">
      {tabs ? <nav className="hk-tabs">{items.map(([href, label, id]) => <Link key={id} href={href} className={`hk-tab${tab === id ? " active" : ""}`}>{label}</Link>)}</nav> : null}
      {children}
    </main>
  </AppShell>;
}

function deptLabel(emp: Employee, t: T) {
  return emp.departmentName || t.noDepartment;
}

export function SchedulePlanPage() {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const { isPlanner, ready, employees, departments, weekStartIso, weekDates, goToPrevWeek, goToNextWeek } = useSchedule();
  const [deptFilter, setDeptFilter] = useState("all");
  const visible = employees.filter((emp) => deptFilter === "all" || (deptFilter === "none" ? !emp.departmentId : emp.departmentId === deptFilter));
  const dayLabels = weekDates.map((iso) => formatDayHeader(iso, locale));

  function copyWeek() {
    const target = window.prompt(t.copyPrompt, t.copyPromptValue);
    if (!target) return;
    toast({ message: fill(t.copyDone, { target }), tone: "success" });
  }

  function exportPlan() {
    const format = window.prompt(t.exportPrompt, "pdf");
    if (!format) return;
    toast({ message: fill(t.exportDone, { format: format.toUpperCase() }), tone: "success" });
  }

  if (!ready) return <Shell title={t.pageTitle} tabs><BrandLoader label={t.loading} /></Shell>;
  if (!isPlanner) {
    router.replace("/schedule/own");
    return <Shell title={t.pageTitle} tabs><p style={{ fontSize: 13, color: "var(--text2)" }}>{t.tabOwn}</p></Shell>;
  }

  return <Shell title={t.pageTitle} tabs>
    <div className="kpi-row" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
      <div className="kpi"><div className="kpi-lbl">{t.kpiStaffWeek}</div><div className="kpi-val">{employees.length}</div><div className="kpi-sub">{t.kpiStaffSub}</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiHours}</div><div className="kpi-val">312<span>{t.hoursUnit}</span></div><div className="kpi-sub"><span className="chip chip-g">{t.kpiHoursChip}</span></div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiOpenShifts}</div><div className="kpi-val" style={{ color: "var(--amber)" }}>1</div><div className="kpi-sub"><span className="chip chip-a">{t.kpiOpenChip}</span></div></div>
    </div>
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="ch" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="ct">{fill(t.weekPlan, { range: formatWeekRange(weekStartIso, locale) })}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={goToPrevWeek}>{t.prevWeek}</button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={goToNextWeek}>{t.nextWeek}</button>
          <select className="field-select" style={{ marginBottom: 0, padding: "6px 10px", fontSize: 12, width: "auto" }} value={deptFilter} onChange={(event) => setDeptFilter(event.target.value)}>
            <option value="all">{t.allDepartments}</option>
            {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
            {employees.some((emp) => !emp.departmentId) ? <option value="none">{t.noDepartment}</option> : null}
          </select>
          <Link href="/schedule/templates" className="btn btn-ghost" style={{ fontSize: 12 }}>{t.templatesBtn}</Link>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={copyWeek}>{t.copyWeek}</button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => window.print()}>{t.print}</button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={exportPlan}>{t.export}</button>
          <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => toast({ message: t.alertPublish, tone: "success" })}>{t.publish}</button>
        </div>
      </div>
      <div className="cb" style={{ overflowX: "auto" }}>
        <div className="dp-grid">
          <div className="dp-head" style={{ textAlign: "left" }}>{t.employeeCol}</div>
          {dayLabels.map((day, index) => <div key={weekDates[index]} className="dp-head">{day}</div>)}
          {visible.length ? visible.map((emp) => <EmployeeRow key={emp.key} emp={emp} t={t} />) : <div className="dp-name" style={{ gridColumn: "1 / -1", color: "var(--text3)", padding: "16px 0" }}>{t.emptyEmployees}</div>}
        </div>
      </div>
    </div>
    <div style={{ padding: "12px 16px", background: "var(--amber-bg)", border: "1px solid #FDE68A", borderRadius: 8, fontSize: 13.5, color: "var(--amber)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      ⚠️ <strong>{t.alertOpenStrong}</strong>{t.alertOpenBody}
      <button type="button" className="btn" style={{ marginLeft: "auto", background: "var(--amber)", color: "#fff", fontSize: 12, padding: "5px 12px" }} onClick={() => toast({ message: t.alertAi, tone: "info" })}>{t.aiSuggest}</button>
    </div>
  </Shell>;
}

function EmployeeRow({ emp, t }: { emp: Employee; t: T }) {
  return <>
    <div className="dp-name">{emp.name}<div className="dp-dept">{deptLabel(emp, t)}</div></div>
    {emp.shifts.map((shift, index) => {
      const meta = shiftMeta(shift, t);
      return <Link key={`${emp.key}-${index}`} href={`/schedule/shift?employee=${emp.key}&day=${index}`} className="dp-cell"><div className={`dp-shift ${meta.cls}`}>{meta.label}</div></Link>;
    })}
  </>;
}

export function ScheduleOwnPage() {
  const t = useT();
  const { locale } = useI18n();
  const { ready, currentUserId, fullName, employees, weekDates } = useSchedule();
  const own = employees.find((item) => item.key === currentUserId) ?? employees[0];
  const dayLabels = weekDates.map((iso) => formatDayHeader(iso, locale));
  if (!ready) return <Shell title={t.pageTitle} tabs><BrandLoader label={t.loading} /></Shell>;
  return <Shell title={t.pageTitle} tabs>
    <section className="card" style={{ marginBottom: 16 }}>
      <div className="ch">
        <div className="ct">{fill(t.ownWeek, { name: fullName || own?.name || "" })}</div>
        <Link href="/schedule/request" className="btn btn-primary" style={{ fontSize: 12 }}>{t.requestBtn}</Link>
      </div>
      <div className="cb">
        {own ? <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
          {dayLabels.map((day, index) => {
            const meta = shiftMeta(own.shifts[index], t);
            return <div key={day} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, marginBottom: 6 }}>{day}</div>
              <div className={`dp-shift ${meta.cls}`}>{meta.label}</div>
            </div>;
          })}
        </div> : <p style={{ fontSize: 13, color: "var(--text3)" }}>{t.emptyEmployees}</p>}
      </div>
    </section>
  </Shell>;
}

export function ScheduleAbsencesPage() {
  const t = useT();
  const { isPlanner, ready, absences, setAbsences, decideAbsence, employees, currentUserId } = useSchedule();
  const [filter, setFilter] = useState<"all" | AbsenceStatus>("all");
  const own = employees.find((item) => item.key === currentUserId) ?? employees[0];
  const rows = absences.filter((item) => filter === "all" || item.status === filter);
  if (!ready) return <Shell title={t.pageTitle} tabs><BrandLoader label={t.loading} /></Shell>;
  return <Shell title={t.pageTitle} tabs>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div className="filter-row" style={{ marginBottom: 0 }}>
        {([["all", t.filterAll], ["open", t.filterOpen], ["approved", t.filterApproved], ["rejected", t.filterRejected]] as const).map(([id, label]) =>
          <button key={id} type="button" className={`filter-btn${filter === id ? " active" : ""}`} onClick={() => setFilter(id)}>{label}</button>)}
      </div>
      <Link href={`/schedule/request${own ? `?employee=${own.key}` : ""}`} className="btn btn-primary" style={{ marginLeft: "auto" }}>{t.addAbsence}</Link>
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
  const { isPlanner, ready, departments } = useSchedule();
  if (!ready) return <Shell title={t.pageTitle} tabs><BrandLoader label={t.loading} /></Shell>;
  if (!isPlanner) {
    router.replace("/schedule/own");
    return <Shell title={t.pageTitle} tabs />;
  }
  return <Shell title={t.pageTitle} tabs>
    <div className="kpi-row" style={{ marginBottom: 18 }}>
      <div className="kpi"><div className="kpi-lbl">{t.kpiTotalHours}</div><div className="kpi-val">0<span>{t.hoursUnit}</span></div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiAvgHours}</div><div className="kpi-val">0<span>{t.hoursUnit}</span></div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiOvertime}</div><div className="kpi-val">0<span>{t.hoursUnit}</span></div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiAbsenceDays}</div><div className="kpi-val">0<span>{t.daysUnit}</span></div></div>
    </div>
    <div className="card">
      <div className="ch"><div className="ct">{t.hoursByDept}</div></div>
      <div className="cb">
        {departments.length ? departments.map((dept, index) => <div key={dept.id} style={{ marginBottom: index === departments.length - 1 ? 0 : 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{dept.name}</span><span>{t.dash}</span></div>
          <div className="progress-bar"><div className="progress-fill bar-a" style={{ width: "0%" }} /></div>
        </div>) : <p style={{ fontSize: 13, color: "var(--text3)" }}>{t.empty}</p>}
      </div>
    </div>
  </Shell>;
}

const REPEAT_WEEKS = [2, 3, 4, 5, 6, 7, 8] as const;

export function ScheduleShiftPage({ employee, day }: { employee: string; day: number }) {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const { ready, shiftsReady, isPlanner, employees, templates, saveShift, weekDates } = useSchedule();
  const emp = employees.find((item) => item.key === employee);
  const dayLabel = weekDates[day] ? formatDayHeader(weekDates[day], locale) : t.days[day] ?? t.days[0];
  const [form, setForm] = useState({ template: "", start: "09:00", end: "17:00", pause: "", note: "", repeat: "none" });
  const [busy, setBusy] = useState(false);
  const blocked = form.template === "off" || form.template === "vac";
  const repeatLabels: Record<(typeof REPEAT_WEEKS)[number], string> = {
    2: t.repeat2, 3: t.repeat3, 4: t.repeat4, 5: t.repeat5, 6: t.repeat6, 7: t.repeat7, 8: t.repeat8,
  };

  useEffect(() => {
    if (!ready || !shiftsReady || !emp) return;
    const cell = emp.shifts[day];
    if (!cell || cell.kind === "empty") return;
    const off = cell.kind === "off" || cell.kind === "vac";
    setForm({
      template: off ? cell.kind : cell.templateId,
      start: off ? "" : cell.start || "09:00",
      end: off ? "" : cell.end || "17:00",
      pause: off ? "" : cell.breakMins ? String(cell.breakMins) : "",
      note: cell.note,
      repeat: "none",
    });
  }, [day, emp, ready, shiftsReady]);

  function applyTemplate(value: string) {
    setForm((current) => {
      if (value === "off" || value === "vac") {
        return { ...current, template: value, start: "", end: "", pause: "", note: "" };
      }
      if (value === "") {
        return { ...current, template: value, start: current.start || "09:00", end: current.end || "17:00" };
      }
      const template = templates.find((item) => item.id === value);
      if (!template) return { ...current, template: value };
      return {
        ...current,
        template: value,
        start: template.start,
        end: template.end,
        pause: template.breakMins ? String(template.breakMins) : "",
        note: template.note,
      };
    });
  }

  async function save() {
    if (!emp || busy) return;
    if (!blocked && (!form.start || !form.end)) {
      toast({ message: t.needShiftTimes, tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const repeatWeeks = form.repeat === "none" ? 1 : Number(form.repeat);
      const saved = await saveShift({
        empKey: emp.key,
        day,
        start: form.start,
        end: form.end,
        breakMins: form.pause,
        note: form.note,
        template: form.template,
        repeatWeeks,
      });
      if (!saved) {
        toast({ message: t.saveShiftFailed, tone: "error" });
        return;
      }
      toast({
        message: saved > 1 ? fill(t.savedRepeatWeeks, { n: String(saved) }) : t.saved,
        tone: "success",
      });
      router.push("/schedule");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !shiftsReady) return <Shell title={t.shiftTitle}><BrandLoader label={t.loading} /></Shell>;
  if (!isPlanner) {
    router.replace("/schedule/own");
    return <Shell title={t.shiftTitle}><BrandLoader label={t.loading} /></Shell>;
  }
  if (!emp) return <Shell title={t.shiftTitle}><Link href="/schedule" className="back-link">{t.back}</Link><p style={{ fontSize: 13, color: "var(--text3)" }}>{t.emptyEmployees}</p></Shell>;

  return <Shell title={t.shiftTitle}>
    {busy ? <BrandLoader label={t.translating} overlay /> : null}
    <Link href="/schedule" className="back-link">{t.back}</Link>
    <section className="card" style={{ maxWidth: 460 }}>
      <div className="ch"><div className="ct">{emp.name} · {dayLabel}</div></div>
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div><label className="field-lbl">{t.presetShift}</label>
          <select className="field-select" value={form.template} onChange={(event) => applyTemplate(event.target.value)}>
            <option value="">{t.manual}</option>
            {templates.map((item) => <option key={item.id} value={item.id}>{templateLabel(item.name, t)} ({item.start}–{item.end})</option>)}
            <option value="off">{t.off}</option>
            <option value="vac">{t.vacation}</option>
          </select>
        </div>
        <div className="field-row">
          <div><label className="field-lbl">{t.start}</label><input className="field-input" type="time" disabled={blocked} value={form.start} onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))} /></div>
          <div><label className="field-lbl">{t.end}</label><input className="field-input" type="time" disabled={blocked} value={form.end} onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))} /></div>
        </div>
        <div><label className="field-lbl">{t.breakMins}</label><input className="field-input" type="number" placeholder="30" disabled={blocked} value={form.pause} onChange={(event) => setForm((current) => ({ ...current, pause: event.target.value }))} /></div>
        <div><label className="field-lbl">{t.note}</label><input className="field-input" placeholder={t.optional} disabled={blocked} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></div>
        <p style={{ fontSize: 12, color: "var(--text3)", margin: 0 }}>{t.autoTranslate}</p>
        <div><label className="field-lbl">{t.repeat}</label>
          <select className="field-select" value={form.repeat} onChange={(event) => setForm((current) => ({ ...current, repeat: event.target.value }))}>
            <option value="none">{t.repeatNone}</option>
            {REPEAT_WEEKS.map((weeks) => <option key={weeks} value={String(weeks)}>{repeatLabels[weeks]}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => void save()}>{t.save}</button>
          <Link href="/schedule" className="btn btn-ghost">{t.cancel}</Link>
        </div>
      </div>
    </section>
  </Shell>;
}

export function ScheduleTemplatesPage() {
  const t = useT();
  const router = useRouter();
  const { ready, isPlanner, templates, deleteTemplate } = useSchedule();

  if (!ready) return <Shell title={t.templatesTitle}><BrandLoader label={t.loading} /></Shell>;
  if (!isPlanner) {
    router.replace("/schedule/own");
    return <Shell title={t.templatesTitle}><BrandLoader label={t.loading} /></Shell>;
  }

  return <Shell title={t.templatesTitle}>
    <Link href="/schedule" className="back-link">{t.back}</Link>
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}><Link href="/schedule/templates/new" className="btn btn-primary">{t.addTemplate}</Link></div>
    {templates.length ? templates.map((item) => <div key={item.id} className="doc-row">
      <div className="doc-ic">🕐</div>
      <Link href={`/schedule/templates/${item.id}`} style={{ flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}>
        <div className="doc-name">{templateLabel(item.name, t)}</div>
        <div style={{ fontSize: 11, color: "var(--text3)" }}>
          {item.start} – {item.end}{item.breakMins ? ` · ${item.breakMins} min` : ""}{item.note ? ` · ${item.note}` : ""}
        </div>
      </Link>
      <Link href={`/schedule/templates/${item.id}`} className="icon-btn">✏️</Link>
      <button type="button" className="icon-btn danger" onClick={() => void deleteTemplate(item.id)}>🗑️</button>
    </div>) : <div style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.noTemplates}</div>}
  </Shell>;
}

export function ScheduleTemplateFormPage({ id }: { id?: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const { ready, isPlanner, templates, saveTemplate } = useSchedule();
  const existing = id ? templates.find((item) => item.id === id) : undefined;
  const [form, setForm] = useState({ name: "", start: "07:00", end: "15:00", pause: "", note: "" });
  const [loaded, setLoaded] = useState(!id);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id || !ready) return;
    if (!existing) {
      setLoaded(true);
      return;
    }
    setForm({
      name: existing.name,
      start: existing.start,
      end: existing.end,
      pause: existing.breakMins ? String(existing.breakMins) : "",
      note: existing.note,
    });
    setLoaded(true);
  }, [existing, id, ready]);

  async function save() {
    if (!form.name.trim()) {
      toast({ message: t.needTemplateName, tone: "error" });
      return;
    }
    if (!form.start || !form.end) {
      toast({ message: t.needShiftTimes, tone: "error" });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const saved = await saveTemplate(id, { name: form.name, start: form.start, end: form.end, breakMins: form.pause, note: form.note });
      if (!saved) {
        toast({ message: t.saveFailed, tone: "error" });
        return;
      }
      toast({ message: t.templateSaved, tone: "success" });
      router.push("/schedule/templates");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !loaded) return <Shell title={id ? t.editTemplate : t.newTemplate}><BrandLoader label={t.loading} /></Shell>;
  if (!isPlanner) {
    router.replace("/schedule/own");
    return <Shell title={t.templatesTitle}><BrandLoader label={t.loading} /></Shell>;
  }
  if (id && !existing) {
    return <Shell title={t.editTemplate}><Link href="/schedule/templates" className="back-link">{t.back}</Link><p style={{ fontSize: 13, color: "var(--text3)" }}>{t.noTemplates}</p></Shell>;
  }

  return <Shell title={id ? t.editTemplate : t.newTemplate}>
    {busy ? <BrandLoader label={t.translating} overlay /> : null}
    <Link href="/schedule/templates" className="back-link">{t.back}</Link>
    <section className="card" style={{ maxWidth: 460 }}>
      <div className="ch"><div className="ct">{id ? t.editTemplate : t.newTemplate}</div></div>
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div><label className="field-lbl">{t.templateName}</label><input className="field-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div>
        <div className="field-row">
          <div><label className="field-lbl">{t.start}</label><input className="field-input" type="time" step="60" value={form.start} onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))} /></div>
          <div><label className="field-lbl">{t.end}</label><input className="field-input" type="time" step="60" value={form.end} onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))} /></div>
        </div>
        <div><label className="field-lbl">{t.breakMins}</label><input className="field-input" type="number" placeholder="30" value={form.pause} onChange={(event) => setForm((current) => ({ ...current, pause: event.target.value }))} /></div>
        <div><label className="field-lbl">{t.note}</label><input className="field-input" placeholder={t.optional} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></div>
        <p style={{ fontSize: 12, color: "var(--text3)", margin: 0 }}>{t.autoTranslate}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={() => void save()}>{t.save}</button>
          <Link href="/schedule/templates" className="btn btn-ghost">{t.cancel}</Link>
        </div>
      </div>
    </section>
  </Shell>;
}

export function ScheduleRequestPage({ employee }: { employee?: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const { ready, employees, isPlanner, currentUserId, setAbsences } = useSchedule();
  const [form, setForm] = useState({
    empKey: employee || "",
    category: "vacation" as AbsenceCategory,
    start: "",
    end: "",
    note: "",
  });

  useEffect(() => {
    setForm((current) => {
      if (current.empKey && employees.some((item) => item.key === current.empKey)) return current;
      const next = employee && employees.some((item) => item.key === employee)
        ? employee
        : currentUserId && employees.some((item) => item.key === currentUserId)
          ? currentUserId
          : employees[0]?.key ?? "";
      return current.empKey === next ? current : { ...current, empKey: next };
    });
  }, [currentUserId, employee, employees]);

  function save(event: FormEvent) {
    event.preventDefault();
    if (!form.start) {
      toast({ message: t.needStart, tone: "error" });
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
    toast({ message: t.requestSent, tone: "success" });
    router.push(isPlanner ? "/schedule/absences" : "/schedule/own");
  }

  if (!ready) return <Shell title={t.requestTitle}><BrandLoader label={t.loading} /></Shell>;

  return <Shell title={t.requestTitle}>
    <Link href={isPlanner ? "/schedule" : "/schedule/own"} className="back-link">{t.back}</Link>
    <form className="card" style={{ maxWidth: 460 }} onSubmit={save}>
      <div className="ch"><div className="ct">{t.requestTitle}</div></div>
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div><label className="field-lbl">{t.employee}</label>
          <select className="field-select" disabled={!isPlanner} value={form.empKey} onChange={(event) => setForm((current) => ({ ...current, empKey: event.target.value }))}>
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
