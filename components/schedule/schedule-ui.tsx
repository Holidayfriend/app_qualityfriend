"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AppShell } from "../dashboard/app-shell";
import { BrandLoader } from "../ui/brand-loader";
import { useToast } from "../ui/toast-provider";
import { useI18n } from "../i18n/i18n-provider";
import { getScheduleMessages, type ScheduleMessages } from "../../lib/i18n/schedule-messages";
import { type AbsenceStatus, type Employee, type LeaveCategory, type LeaveDuration, type ShiftCell } from "../../lib/schedule/demo-data";
import { formatDayHeader, formatWeekRange } from "../../lib/schedule/week";
import { formatWorkHours, weekWorkHours } from "../../lib/schedule/hours";
import { useSchedule } from "./schedule-provider";

type T = ScheduleMessages;
type Tab = "plan" | "own" | "absence" | "swap" | "stats";

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
  if (!cell || cell.kind === "empty") return { label: t.dash, sub: "", cls: "dp-off" };
  if (cell.kind === "vac") {
    if (cell.leaveDuration === "partial" && cell.start && cell.end) {
      return { label: `${cell.start.slice(0, 5)}–${cell.end.slice(0, 5)}`, sub: t.partialVacation, cls: "dp-vac" };
    }
    return { label: t.fullVacation, sub: "", cls: "dp-vac" };
  }
  if (cell.kind === "off") {
    if (cell.leaveDuration === "partial" && cell.start && cell.end) {
      const sub = cell.leaveCategory === "unpaid" ? t.partialUnpaid : cell.leaveCategory === "paidSick" ? t.partialPaidSick : t.partialPaid;
      return { label: `${cell.start.slice(0, 5)}–${cell.end.slice(0, 5)}`, sub, cls: "dp-m" };
    }
    const label = cell.leaveCategory === "unpaid" ? t.fullUnpaid : cell.leaveCategory === "paidSick" ? t.fullPaidSick : t.fullPaid;
    return { label, sub: "", cls: "dp-off" };
  }
  const start = cell.start.slice(0, 5);
  const end = cell.end.slice(0, 5);
  const cls = start <= "08:00" ? "dp-f" : start <= "13:00" ? "dp-m" : "dp-s";
  return { label: start && end ? `${start}–${end}` : t.dash, sub: "", cls };
}

function categoryLabel(category: LeaveCategory, t: T) {
  if (category === "unpaid") return t.leaveUnpaid;
  if (category === "paidSick") return t.leavePaidSick;
  if (category === "swap") return t.leaveSwap;
  if (category === "vacation") return t.leaveVacation;
  return t.leavePaid;
}

function durationLabel(category: LeaveCategory, duration: LeaveDuration, t: T) {
  return duration === "partial" ? t.durationPartial : t.durationFull;
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
  const tab: Tab = pathname.startsWith("/schedule/stats") ? "stats" : pathname.startsWith("/schedule/swaps") ? "swap" : pathname.startsWith("/schedule/absences") ? "absence" : pathname.startsWith("/schedule/own") ? "own" : "plan";
  const items = isPlanner ? [
    ["/schedule", t.tabPlan, "plan"] as const,
    ["/schedule/own", t.tabOwn, "own"] as const,
    ["/schedule/absences", t.tabAbsence, "absence"] as const,
    ["/schedule/swaps", t.tabSwap, "swap"] as const,
    ["/schedule/stats", t.tabStats, "stats"] as const,
  ] : [
    ["/schedule/own", t.tabOwn, "own"] as const,
    ["/schedule/absences", t.tabAbsence, "absence"] as const,
    ["/schedule/swaps", t.tabSwap, "swap"] as const,
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
  const { isPlanner, ready, employees, departments, weekStartIso, weekDates, goToPrevWeek, goToNextWeek, publishWeek, draftCount } = useSchedule();
  const [deptFilter, setDeptFilter] = useState("all");
  const [publishing, setPublishing] = useState(false);
  const visible = employees.filter((emp) => deptFilter === "all" || (deptFilter === "none" ? !emp.departmentId : emp.departmentId === deptFilter));
  const scheduledHours = weekWorkHours(visible);
  const dayLabels = weekDates.map((iso) => formatDayHeader(iso, locale));

  function copyWeek() {
    const target = window.prompt(t.copyPrompt, t.copyPromptValue);
    if (!target) return;
    toast({ message: fill(t.copyDone, { target }), tone: "success" });
  }

  async function publish() {
    if (!draftCount || publishing) return;
    setPublishing(true);
    try {
      const result = await publishWeek();
      if (!result) {
        toast({ message: t.publishFailed, tone: "error" });
        return;
      }
      toast({
        message: result.employees ? fill(t.publishedOk, { n: String(result.employees) }) : t.publishedNone,
        tone: "success",
      });
    } finally {
      setPublishing(false);
    }
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
    {publishing ? <BrandLoader label={t.publishing} overlay /> : null}
    <div className="kpi-row" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
      <div className="kpi"><div className="kpi-lbl">{t.kpiStaffWeek}</div><div className="kpi-val">{employees.length}</div><div className="kpi-sub">{t.kpiStaffSub}</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiHours}</div><div className="kpi-val">{formatWorkHours(scheduledHours)}<span>{t.hoursUnit}</span></div><div className="kpi-sub">{formatWeekRange(weekStartIso, locale)}</div></div>
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
          <button type="button" className="btn btn-primary" style={{ fontSize: 12 }} disabled={!draftCount || publishing} onClick={() => void publish()}>{draftCount ? fill(t.publishChanges, { n: String(draftCount) }) : t.publish}</button>
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
      return <Link key={`${emp.key}-${index}`} href={`/schedule/shift?employee=${emp.key}&day=${index}`} className="dp-cell"><div className={`dp-shift ${meta.cls}${shift.draft ? " dp-draft" : ""}`}>{meta.label}{meta.sub ? <span style={{ display: "block", fontSize: 9, fontWeight: 500, marginTop: 1 }}>{meta.sub}</span> : null}</div></Link>;
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
      <div className="ch" style={{ flexWrap: "wrap", gap: 8 }}>
        <div className="ct">{fill(t.ownWeek, { name: fullName || own?.name || "" })}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/schedule/request?type=leave" className="btn btn-primary" style={{ fontSize: 12 }}>{t.requestLeaveBtn}</Link>
          <Link href="/schedule/request?type=swap" className="btn btn-ghost" style={{ fontSize: 12 }}>{t.requestSwapBtn}</Link>
        </div>
      </div>
      <div className="cb">
        {own ? <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 8 }}>
          {dayLabels.map((day, index) => {
            const meta = shiftMeta(own.shifts[index], t);
            return <div key={day} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, marginBottom: 6 }}>{day}</div>
              <div className={`dp-shift ${meta.cls}`}>{meta.label}{meta.sub ? <span style={{ display: "block", fontSize: 9, fontWeight: 500, marginTop: 1 }}>{meta.sub}</span> : null}</div>
            </div>;
          })}
        </div> : <p style={{ fontSize: 13, color: "var(--text3)" }}>{t.emptyEmployees}</p>}
      </div>
    </section>
  </Shell>;
}

export function ScheduleAbsencesPage({ board }: { board?: "swap" }) {
  const t = useT();
  const toast = useToast();
  const { isPlanner, ready, absences, decideAbsence, employees, currentUserId } = useSchedule();
  const [filter, setFilter] = useState<"all" | AbsenceStatus>("all");
  const [busyId, setBusyId] = useState("");
  const own = employees.find((item) => item.key === currentUserId) ?? employees[0];
  const swapBoard = board === "swap";
  const rows = absences.filter((item) => {
    if (swapBoard && item.category !== "swap") return false;
    if (!swapBoard && item.category === "swap") return false;
    return filter === "all" || item.status === filter;
  });

  async function decide(id: string, status: AbsenceStatus) {
    if (busyId) return;
    setBusyId(id);
    try {
      const ok = await decideAbsence(id, status);
      toast({ message: ok ? (status === "approved" ? (swapBoard ? t.swapApproved : t.absenceApproved) : t.absenceRejected) : t.saveShiftFailed, tone: ok ? "success" : "error" });
    } finally {
      setBusyId("");
    }
  }

  const heading = swapBoard ? t.tabSwap : t.requestLeaveTitle;
  if (!ready) return <Shell title={heading} tabs><BrandLoader label={t.loading} /></Shell>;
  return <Shell title={heading} tabs>
    {busyId ? <BrandLoader label={t.loading} overlay /> : null}
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div className="filter-row" style={{ marginBottom: 0 }}>
        {([["all", t.filterAll], ["open", t.filterOpen], ["approved", t.filterApproved], ["rejected", t.filterRejected]] as const).map(([id, label]) =>
          <button key={id} type="button" className={`filter-btn${filter === id ? " active" : ""}`} onClick={() => setFilter(id)}>{label}</button>)}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {isPlanner
          ? swapBoard
            ? <Link href={`/schedule/request?type=swap${own ? `&employee=${own.key}` : ""}`} className="btn btn-primary">{t.addSwap}</Link>
            : <Link href={`/schedule/request?type=leave${own ? `&employee=${own.key}` : ""}`} className="btn btn-primary">{t.addAbsence}</Link>
          : swapBoard
            ? <Link href="/schedule/request?type=swap" className="btn btn-primary">{t.requestSwapBtn}</Link>
            : <Link href="/schedule/request?type=leave" className="btn btn-primary">{t.addAbsence}</Link>}
      </div>
    </div>
    <div className="card">
      <table className="bud-table" style={{ width: "100%" }}>
        <thead><tr><th>{t.colEmployee}</th>{swapBoard ? <th>{t.colSwapWith}</th> : <th>{t.colCategory}</th>}<th>{t.colDuration}</th><th>{t.colPeriod}</th><th>{t.colNote}</th><th>{t.colStatus}</th><th>{t.colDecidedBy}</th><th style={{ textAlign: "right" }}>{t.colActions}</th></tr></thead>
        <tbody>
          {rows.length ? rows.map((item) => {
            const status = statusMeta(item.status, t);
            return <tr key={item.id}>
              <td>{item.employee}</td>
              {swapBoard ? <td>{item.swapWith || t.dash}</td> : <td>{categoryLabel(item.category, t)}</td>}
              <td>{item.category === "swap" ? t.dash : durationLabel(item.category, item.duration, t)}{item.category !== "swap" && item.duration === "partial" && item.startTime && item.endTime ? ` (${item.startTime}–${item.endTime})` : ""}</td>
              <td>{item.start}{item.end !== item.start ? ` ${t.dash} ${item.end}` : ""}</td>
              <td>{item.note || t.dash}</td>
              <td><span className={`chip ${status.cls}`}>{status.label}</span></td>
              <td>{item.status === "approved" && item.decidedBy ? fill(t.approvedBy, { name: item.decidedBy }) : item.status === "rejected" && item.decidedBy ? fill(t.rejectedBy, { name: item.decidedBy }) : t.dash}</td>
              <td style={{ textAlign: "right" }}>{isPlanner && item.status === "open"
                ? <><button type="button" className="icon-btn" disabled={Boolean(busyId)} onClick={() => void decide(item.id, "approved")}>✅</button> <button type="button" className="icon-btn danger" disabled={Boolean(busyId)} onClick={() => void decide(item.id, "rejected")}>✖️</button></>
                : t.dash}</td>
            </tr>;
          }) : <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text3)", padding: 20 }}>{t.empty}</td></tr>}
        </tbody>
      </table>
    </div>
  </Shell>;
}

export function ScheduleStatsPage() {
  const t = useT();
  const router = useRouter();
  const { isPlanner, ready, departments, employees } = useSchedule();
  const scheduledHours = weekWorkHours(employees);
  const avgHours = employees.length ? scheduledHours / employees.length : 0;
  const absenceDays = employees.reduce((total, emp) => total + emp.shifts.filter((shift) => shift.kind === "off" || shift.kind === "vac").length, 0);
  const deptHours = departments.map((dept) => ({
    id: dept.id,
    name: dept.name,
    hours: weekWorkHours(employees.filter((emp) => emp.departmentId === dept.id)),
  }));
  const maxDeptHours = Math.max(...deptHours.map((dept) => dept.hours), 0);
  if (!ready) return <Shell title={t.pageTitle} tabs><BrandLoader label={t.loading} /></Shell>;
  if (!isPlanner) {
    router.replace("/schedule/own");
    return <Shell title={t.pageTitle} tabs />;
  }
  return <Shell title={t.pageTitle} tabs>
    <div className="kpi-row" style={{ marginBottom: 18 }}>
      <div className="kpi"><div className="kpi-lbl">{t.kpiTotalHours}</div><div className="kpi-val">{formatWorkHours(scheduledHours)}<span>{t.hoursUnit}</span></div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiAvgHours}</div><div className="kpi-val">{formatWorkHours(avgHours)}<span>{t.hoursUnit}</span></div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiOvertime}</div><div className="kpi-val">0<span>{t.hoursUnit}</span></div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiAbsenceDays}</div><div className="kpi-val">{absenceDays}<span>{t.daysUnit}</span></div></div>
    </div>
    <div className="card">
      <div className="ch"><div className="ct">{t.hoursByDept}</div></div>
      <div className="cb">
        {deptHours.length ? deptHours.map((dept, index) => <div key={dept.id} style={{ marginBottom: index === deptHours.length - 1 ? 0 : 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{dept.name}</span><span>{formatWorkHours(dept.hours)}{t.hoursUnit}</span></div>
          <div className="progress-bar"><div className="progress-fill bar-a" style={{ width: `${maxDeptHours ? Math.round((dept.hours / maxDeptHours) * 100) : 0}%` }} /></div>
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
  const [form, setForm] = useState({
    template: "", start: "09:00", end: "17:00", pause: "", note: "", repeat: "none",
    leaveCategory: "paid" as LeaveCategory, leaveDuration: "full" as LeaveDuration,
  });
  const [busy, setBusy] = useState(false);
  const isOff = form.template === "off";
  const isVac = form.template === "vac";
  const isLeave = isOff || isVac;
  const partialLeave = isLeave && form.leaveDuration === "partial";
  const hideWorkTimes = isLeave && !partialLeave;
  const repeatLabels: Record<(typeof REPEAT_WEEKS)[number], string> = {
    2: t.repeat2, 3: t.repeat3, 4: t.repeat4, 5: t.repeat5, 6: t.repeat6, 7: t.repeat7, 8: t.repeat8,
  };

  useEffect(() => {
    if (!ready || !shiftsReady || !emp) return;
    const cell = emp.shifts[day];
    if (!cell || cell.kind === "empty") return;
    const off = cell.kind === "off";
    const vac = cell.kind === "vac";
    const partial = (off || vac) && cell.leaveDuration === "partial";
    setForm({
      template: off ? "off" : vac ? "vac" : cell.templateId,
      start: (off || vac) && !partial ? "" : cell.start || "09:00",
      end: (off || vac) && !partial ? "" : cell.end || "17:00",
      pause: off || vac ? "" : cell.breakMins ? String(cell.breakMins) : "",
      note: cell.note,
      repeat: "none",
      leaveCategory: cell.leaveCategory || "paid",
      leaveDuration: cell.leaveDuration || "full",
    });
  }, [day, emp, ready, shiftsReady]);

  function applyTemplate(value: string) {
    setForm((current) => {
      if (value === "off" || value === "vac") {
        return { ...current, template: value, start: "", end: "", pause: "", note: "", leaveCategory: "paid", leaveDuration: "full" };
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
    const needsTimes = !hideWorkTimes;
    if (needsTimes && (!form.start || !form.end)) {
      toast({ message: t.needShiftTimes, tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const saved = await saveShift({
        empKey: emp.key,
        day,
        start: form.start,
        end: form.end,
        breakMins: form.pause,
        note: form.note,
        template: form.template,
        repeat: form.repeat,
        leaveCategory: form.leaveCategory,
        leaveDuration: form.leaveDuration,
      });
      if (!saved) {
        toast({ message: t.saveShiftFailed, tone: "error" });
        return;
      }
      toast({
        message: form.repeat === "none" ? t.saved : form.repeat === "thisWeek" ? t.savedRepeatThisWeek : fill(t.savedRepeatWeeks, { n: form.repeat }),
        tone: "success",
      });
      router.push("/schedule");
    } catch (error) {
      toast({ message: error instanceof Error && error.message ? error.message : t.saveShiftFailed, tone: "error" });
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
        {emp.shifts[day]?.updatedBy ? <p style={{ fontSize: 12, color: "var(--text3)", margin: 0 }}>{fill(t.lastUpdatedBy, { name: emp.shifts[day].updatedBy })}</p> : null}
        <div><label className="field-lbl">{t.presetShift}</label>
          <select className="field-select" value={form.template} onChange={(event) => applyTemplate(event.target.value)}>
            <option value="">{t.manual}</option>
            {templates.map((item) => <option key={item.id} value={item.id}>{templateLabel(item.name, t)} ({item.start}–{item.end})</option>)}
            <option value="off">{t.off}</option>
            <option value="vac">{t.vacation}</option>
          </select>
        </div>
        {isLeave ? <>
          {isOff ? <div><label className="field-lbl">{t.leaveCategory}</label>
            <select className="field-select" value={form.leaveCategory} onChange={(event) => setForm((current) => ({ ...current, leaveCategory: event.target.value as LeaveCategory }))}>
              <option value="paid">{t.leavePaid}</option>
              <option value="unpaid">{t.leaveUnpaid}</option>
              <option value="paidSick">{t.leavePaidSick}</option>
            </select>
          </div> : null}
          <div><label className="field-lbl">{t.leaveDuration}</label>
            <select className="field-select" value={form.leaveDuration} onChange={(event) => {
              const leaveDuration = event.target.value as LeaveDuration;
              setForm((current) => ({
                ...current,
                leaveDuration,
                start: leaveDuration === "partial" ? (current.start || "09:00") : "",
                end: leaveDuration === "partial" ? (current.end || "17:00") : "",
              }));
            }}>
              <option value="full">{t.durationFull}</option>
              <option value="partial">{t.durationPartial}</option>
            </select>
          </div>
        </> : null}
        {hideWorkTimes ? null : <>
          <div className="field-row">
            <div><label className="field-lbl">{partialLeave ? t.workTimes : t.start}</label><input className="field-input" type="time" value={form.start} onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))} /></div>
            <div><label className="field-lbl">{t.end}</label><input className="field-input" type="time" value={form.end} onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))} /></div>
          </div>
          {isLeave ? null : <div><label className="field-lbl">{t.breakMins}</label><input className="field-input" type="number" placeholder="30" value={form.pause} onChange={(event) => setForm((current) => ({ ...current, pause: event.target.value }))} /></div>}
        </>}
        <div><label className="field-lbl">{isLeave ? t.comment : t.note}</label><input className="field-input" placeholder={t.optional} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></div>
        <p style={{ fontSize: 12, color: "var(--text3)", margin: 0 }}>{t.autoTranslate}</p>
        <div><label className="field-lbl">{t.repeat}</label>
          <select className="field-select" value={form.repeat} onChange={(event) => setForm((current) => ({ ...current, repeat: event.target.value }))}>
            <option value="none">{t.repeatNone}</option>
            <option value="thisWeek">{t.repeatThisWeek}</option>
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

export function ScheduleRequestPage({ employee, requestType }: { employee?: string; requestType?: string }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const { ready, employees, isPlanner, currentUserId, saveAbsence } = useSchedule();
  const lockedSwap = requestType === "swap";
  const lockedLeave = requestType === "leave";
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    empKey: employee || "",
    category: (lockedSwap ? "swap" : "paid") as LeaveCategory,
    duration: "full" as LeaveDuration,
    start: "",
    end: "",
    startTime: "09:00",
    endTime: "17:00",
    note: "",
    swapWithKey: "",
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

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form.start) {
      toast({ message: t.needStart, tone: "error" });
      return;
    }
    const isSwap = form.category === "swap";
    if (isSwap && (!form.swapWithKey || form.swapWithKey === form.empKey)) {
      toast({ message: t.needSwapPartner, tone: "error" });
      return;
    }
    if (!isSwap && form.duration === "partial" && (!form.startTime || !form.endTime)) {
      toast({ message: t.needShiftTimes, tone: "error" });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const ok = await saveAbsence({
        userId: form.empKey,
        start: form.start,
        end: form.end || form.start,
        category: form.category,
        duration: isSwap ? "full" : form.duration,
        startTime: form.startTime,
        endTime: form.endTime,
        note: form.note,
        applyDirect: isPlanner,
        swapWithUserId: isSwap ? form.swapWithKey : undefined,
      });
      if (!ok) {
        toast({ message: t.requestFailed, tone: "error" });
        return;
      }
      toast({ message: isPlanner ? (isSwap ? t.swapRecorded : t.absenceRecorded) : (isSwap ? t.requestSwapSent : t.requestSent), tone: "success" });
      router.push(isPlanner && isSwap ? "/schedule/swaps" : "/schedule/absences");
    } finally {
      setBusy(false);
    }
  }

  const title = lockedSwap
    ? (isPlanner ? t.recordSwapTitle : t.requestSwapTitle)
    : lockedLeave
      ? t.requestLeaveTitle
      : isPlanner ? t.requestLeaveTitle : t.requestTitle;
  if (!ready) return <Shell title={title}><BrandLoader label={t.loading} /></Shell>;

  return <Shell title={title}>
    {busy ? <BrandLoader label={t.translating} overlay /> : null}
    <Link href={isPlanner && lockedSwap ? "/schedule/swaps" : "/schedule/absences"} className="back-link">{t.back}</Link>
    <form className="card" style={{ maxWidth: 460 }} onSubmit={(event) => void save(event)}>
      <div className="ch"><div className="ct">{title}</div></div>
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div><label className="field-lbl">{t.employee}</label>
          <select className="field-select" disabled={!isPlanner} value={form.empKey} onChange={(event) => setForm((current) => ({
            ...current,
            empKey: event.target.value,
            swapWithKey: current.swapWithKey === event.target.value ? "" : current.swapWithKey,
          }))}>
            {employees.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
          </select>
        </div>
        {lockedSwap ? null : <div><label className="field-lbl">{t.requestKind}</label>
          <select className="field-select" value={form.category === "vacation" ? "vacation" : "off"} onChange={(event) => setForm((current) => ({
            ...current,
            category: event.target.value === "vacation" ? "vacation" : current.category === "vacation" || current.category === "swap" ? "paid" : current.category,
          }))}>
            <option value="off">{t.requestKindOff}</option>
            <option value="vacation">{t.requestKindVacation}</option>
          </select>
        </div>}
        {lockedSwap ? <div><label className="field-lbl">{t.leaveCategory}</label>
          <select className="field-select" disabled value="swap"><option value="swap">{t.leaveSwap}</option></select>
        </div> : form.category !== "vacation" ? <div><label className="field-lbl">{t.leaveCategory}</label>
          <select className="field-select" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as LeaveCategory }))}>
            <option value="paid">{t.leavePaid}</option>
            <option value="unpaid">{t.leaveUnpaid}</option>
            <option value="paidSick">{t.leavePaidSick}</option>
          </select>
        </div> : null}
        {form.category === "swap" ? <div><label className="field-lbl">{t.swapWith}</label>
          <select className="field-select" value={form.swapWithKey} onChange={(event) => setForm((current) => ({ ...current, swapWithKey: event.target.value }))}>
            <option value="">{t.swapWithPlaceholder}</option>
            {employees.filter((item) => item.key !== form.empKey).map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
          </select>
          <p style={{ fontSize: 12, color: "var(--text3)", margin: "6px 0 0" }}>{t.swapWithHint}</p>
        </div> : null}
        {form.category !== "swap" ? <div><label className="field-lbl">{t.leaveDuration}</label>
          <select className="field-select" value={form.duration} onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value as LeaveDuration }))}>
            <option value="full">{t.durationFull}</option>
            <option value="partial">{t.durationPartial}</option>
          </select>
        </div> : null}
        <div className="field-row">
          <div><label className="field-lbl">{t.from}</label><input className="field-input" type="date" value={form.start} onChange={(event) => setForm((current) => ({ ...current, start: event.target.value }))} /></div>
          <div><label className="field-lbl">{t.to}</label><input className="field-input" type="date" value={form.end} onChange={(event) => setForm((current) => ({ ...current, end: event.target.value }))} /></div>
        </div>
        {form.category !== "swap" && form.duration === "partial" ? <div className="field-row">
          <div><label className="field-lbl">{t.workTimes}</label><input className="field-input" type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} /></div>
          <div><label className="field-lbl">{t.end}</label><input className="field-input" type="time" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} /></div>
        </div> : null}
        <div><label className="field-lbl">{t.comment}</label><input className="field-input" placeholder={t.optional} value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} /></div>
        <p style={{ fontSize: 12, color: "var(--text3)", margin: 0 }}>{t.autoTranslate}</p>
        <button type="submit" className="btn btn-primary" disabled={busy}>{lockedSwap && !isPlanner ? t.sendRequest : t.save}</button>
      </div>
    </form>
  </Shell>;
}
