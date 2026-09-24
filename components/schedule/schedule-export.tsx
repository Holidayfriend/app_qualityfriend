"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell } from "../dashboard/app-shell";
import { BrandLoader } from "../ui/brand-loader";
import { useToast } from "../ui/toast-provider";
import { useI18n } from "../i18n/i18n-provider";
import { getScheduleMessages } from "../../lib/i18n/schedule-messages";
import { addDaysIso, mondayOfIso } from "../../lib/schedule/week";
import { useSchedule } from "./schedule-provider";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function ScheduleExportPage() {
  const params = useSearchParams();
  const toast = useToast();
  const { locale } = useI18n();
  const t = getScheduleMessages(locale);
  const { ready, employees, departments, weekStartIso } = useSchedule();
  const defaults = useMemo(() => {
    const week = DATE.test(params.get("weekStart") || "") ? mondayOfIso(params.get("weekStart") || "") : weekStartIso;
    const from = DATE.test(params.get("from") || "") ? params.get("from") || week : week;
    const to = DATE.test(params.get("to") || "") ? params.get("to") || addDaysIso(week, 6) : addDaysIso(week, 6);
    return { from, to, department: params.get("department") || "all", userId: params.get("userId") || "" };
  }, [params, weekStartIso]);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [department, setDepartment] = useState(defaults.department);
  const [userId, setUserId] = useState(defaults.userId);
  const [busy, setBusy] = useState(false);

  const people = employees.filter((emp) => department === "all" || (department === "none" ? !emp.departmentId : emp.departmentId === department));

  async function download(format: "xls" | "csv") {
    if (!DATE.test(from) || !DATE.test(to) || to < from) {
      toast({ message: t.exportNeedDates, tone: "error" });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const query = new URLSearchParams({ from, to, department, userId, locale, format });
      const response = await fetch(`/api/schedule/export?${query}`, { cache: "no-store" });
      if (!response.ok) {
        toast({ message: t.exportFailed, tone: "error" });
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `schedule-${from}-to-${to}.${format === "csv" ? "csv" : "xls"}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ message: t.exportFailed, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <AppShell activeItem="schedule" pageTitle={t.exportTitle}>
      <main className="qf-dashboard pb-24 lg:pb-[24px]"><BrandLoader label={t.loading} /></main>
    </AppShell>;
  }

  return <AppShell activeItem="schedule" pageTitle={t.exportTitle}>
    <main className="qf-dashboard pb-24 lg:pb-[24px]">
      {busy ? <BrandLoader overlay label={t.exporting} /> : null}
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="ch" style={{ flexWrap: "wrap", gap: 8 }}>
          <div className="ct">{t.exportTitle}</div>
          <Link href="/schedule" className="btn btn-ghost" style={{ fontSize: 12 }}>{t.back}</Link>
        </div>
        <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text2)" }}>{t.exportHint}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="field-lbl">{t.exportFrom}</label>
              <input className="field-input" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div>
              <label className="field-lbl">{t.exportTo}</label>
              <input className="field-input" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
          </div>
          <div>
            <label className="field-lbl">{t.exportColDepartment}</label>
            <select className="field-select" value={department} onChange={(event) => { setDepartment(event.target.value); setUserId(""); }}>
              <option value="all">{t.allDepartments}</option>
              {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
              {employees.some((emp) => !emp.departmentId) ? <option value="none">{t.noDepartment}</option> : null}
            </select>
          </div>
          <div>
            <label className="field-lbl">{t.exportPerson}</label>
            <select className="field-select" value={userId} onChange={(event) => setUserId(event.target.value)}>
              <option value="">{t.exportAllPeople}</option>
              {people.map((emp) => <option key={emp.key} value={emp.key}>{emp.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void download("xls")}>{t.exportExcel}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void download("csv")}>{t.exportCsv}</button>
          </div>
        </div>
      </div>
    </main>
  </AppShell>;
}
