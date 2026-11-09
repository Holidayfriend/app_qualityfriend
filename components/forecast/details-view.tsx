"use client";

import { useEffect, useState } from "react";
import { useI18n } from "../i18n/i18n-provider";
import { useToast } from "../ui/toast-provider";
import { Card, DataTable, ForecastShell, Td, useForecast } from "./forecast-ui";

type MonthRow = { year: number; month: number; occupancy: number; current: number | null; recommended: number | null; revenue: number; lastYearRevenue: number; vsLastYear: number | null };
type CategoryRow = { id: string; nameEn: string; nameDe: string | null; nameIt: string | null; rooms: number; occupancy: number; current: number | null; recommended: number | null; share: number };
type BudgetData = { generatedAt: string | null; year: number | null; currentMonth: number | null; months: MonthRow[]; categories: CategoryRow[] };

const emptyBudget: BudgetData = { generatedAt: null, year: null, currentMonth: null, months: [], categories: [] };

function euro(value: number | null) {
  if (value == null) return "–";
  return `${Math.round(value)}€`;
}

function money(value: number, locale: string) {
  return `${new Intl.NumberFormat(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB", { maximumFractionDigits: 0 }).format(value)}€`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function yearChange(value: number | null) {
  if (value == null) return { text: "–", tone: "text-[var(--qf-text-muted)]" };
  if (value > 0) return { text: `+${value}%`, tone: "text-[#16A34A]" };
  if (value < 0) return { text: `${value}%`.replace("-", "−"), tone: "text-[#DC2626]" };
  return { text: "±0%", tone: "text-[var(--qf-text-muted)]" };
}

export function DetailsView() {
  const t = useForecast().details;
  const { locale } = useI18n();
  const showToast = useToast();
  const [refreshing, setRefreshing] = useState<"xml" | "tables" | null>(null);
  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState<BudgetData>(emptyBudget);

  async function loadBudget() {
    const response = await fetch("/api/budget/summary", { cache: "no-store" });
    if (!response.ok) throw new Error("load");
    return response.json() as Promise<BudgetData>;
  }

  useEffect(() => {
    let active = true;
    loadBudget().then((data) => {
      if (active) setBudget(data);
    }).catch(() => {
      if (active) setBudget(emptyBudget);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function refreshForecastXml() {
    if (refreshing) return;
    setRefreshing("xml");
    try {
      const response = await fetch("/api/budget/forecast-xml", { method: "POST" });
      const body = await response.json();
      if (response.status === 202 && body.status === "queued") showToast({ message: t.xmlQueued, tone: "success" });
      else {
        const errors: Record<string, string> = {
          ASA_XML_NAME_REQUIRED: t.missing,
          INVALID_ASA_XML_NAME: t.invalid,
          ASA_XML_NOT_FOUND: t.notFound,
          UNAUTHENTICATED: t.unauthenticated,
          FORBIDDEN: t.forbidden,
          REFRESH_ALREADY_PENDING: t.pending,
        };
        showToast({ message: errors[body.error] ?? t.failed, tone: "error" });
      }
    } catch {
      showToast({ message: t.failed, tone: "error" });
    } finally {
      setRefreshing(null);
    }
  }

  async function refreshForecast() {
    if (refreshing) return;
    setRefreshing("tables");
    const previous = budget.generatedAt;
    try {
      const response = await fetch("/api/budget/refresh", { method: "POST" });
      const body = await response.json();
      if (response.status !== 202 || body.status !== "queued") {
        const errors: Record<string, string> = { UNAUTHENTICATED: t.unauthenticated, FORBIDDEN: t.forbidden, REFRESH_ALREADY_PENDING: t.pending };
        showToast({ message: errors[body.error] ?? t.failed, tone: "error" });
        return;
      }
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const data = await loadBudget();
        if (data.generatedAt && data.generatedAt !== previous) {
          setBudget(data);
          showToast({ message: t.updated, tone: "success" });
          return;
        }
      }
      showToast({ message: t.queued, tone: "success" });
    } catch {
      showToast({ message: t.failed, tone: "error" });
    } finally {
      setRefreshing(null);
    }
  }

  const localeTag = locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB";
  const monthName = (year: number, month: number) => new Intl.DateTimeFormat(localeTag, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  const categoryName = (row: CategoryRow) => locale === "de" ? row.nameDe || row.nameEn : locale === "it" ? row.nameIt || row.nameEn : row.nameEn;
  const seasonDays = budget.months.reduce((sum, row) => sum + daysInMonth(row.year, row.month), 0);
  const totalOccupancy = seasonDays > 0 ? Math.round(budget.months.reduce((sum, row) => sum + row.occupancy * daysInMonth(row.year, row.month), 0) / seasonDays) : 0;
  const totalRevenue = budget.months.reduce((sum, row) => sum + row.revenue, 0);
  const totalLastYear = budget.months.reduce((sum, row) => sum + row.lastYearRevenue, 0);
  const totalChange = totalLastYear > 0 ? Math.round(((totalRevenue - totalLastYear) / totalLastYear) * 1000) / 10 : null;
  const totalRooms = budget.categories.reduce((sum, row) => sum + row.rooms, 0);
  const categoryOccupancy = totalRooms > 0 ? Math.round(budget.categories.reduce((sum, row) => sum + row.occupancy * row.rooms, 0) / totalRooms) : 0;
  const titleYear = budget.year ?? new Date().getFullYear();

  return (
    <ForecastShell activeItem="budget">
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={() => void refreshForecastXml()} disabled={refreshing != null} aria-busy={refreshing === "xml"} className="inline-flex items-center gap-2 rounded-[7px] border border-[var(--qf-border)] bg-white px-3 py-1.5 text-[12.5px] font-semibold disabled:cursor-wait disabled:opacity-60">
          {refreshing === "xml" ? t.refreshing : t.refreshForecastXml}
        </button>
        <button type="button" onClick={() => void refreshForecast()} disabled={refreshing != null} aria-busy={refreshing === "tables"} className="inline-flex items-center gap-2 rounded-[7px] border border-[var(--qf-border)] bg-white px-3 py-1.5 text-[12.5px] font-semibold disabled:cursor-wait disabled:opacity-60">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.55-2.1L20 8M4 16l2.35 3.1A7 7 0 0 0 17.9 17" /></svg>
          {refreshing === "tables" ? t.refreshing : t.refreshForecast}
        </button>
      </div>
      <div className="mb-[18px]">
        <Card title={t.monthsTitle.replace("{year}", String(titleYear))} action={t.monthsBasis} flush>
          <DataTable headers={[{ label: t.month }, { label: t.avgOccupancy }, { label: t.adrCurrent }, { label: t.adrRecommended }, { label: t.forecastRevenue }, { label: t.vsLastYear }]}>
            {budget.months.map((month, index) => {
              const change = yearChange(month.vsLastYear);
              return (
                <tr key={`${month.year}-${month.month}`} className="group">
                  <Td strong>{monthName(month.year, month.month)} {index === 0 ? <span className="font-normal">{t.running}</span> : null}</Td>
                  <Td>{month.occupancy}%</Td>
                  <Td>{euro(month.current)}</Td>
                  <Td>{euro(month.recommended)}</Td>
                  <Td>{money(month.revenue, locale)}</Td>
                  <Td><span className={change.tone}>{change.text}</span></Td>
                </tr>
              );
            })}
            {budget.months.length > 0 ? (
              <tr className="bg-[#F3F4F6] font-bold">
                <Td strong>{t.total}</Td>
                <Td>{totalOccupancy}%</Td>
                <Td>–</Td>
                <Td>–</Td>
                <Td strong>{money(totalRevenue, locale)}</Td>
                <Td><span className={`font-bold ${yearChange(totalChange).tone}`}>{yearChange(totalChange).text}</span></Td>
              </tr>
            ) : (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-[13px] text-[var(--qf-text-muted)]">{loading ? t.refreshing : t.emptyBudget}</td>
              </tr>
            )}
          </DataTable>
        </Card>
      </div>
      <Card title={t.roomsTitle} action={t.currentMonth} flush>
        <DataTable headers={[{ label: t.category }, { label: t.rooms }, { label: t.occupancy }, { label: t.adrCurrent }, { label: t.adrRecommended }, { label: t.revenueShare }]}>
          {budget.categories.map((room) => (
            <tr key={room.id} className="group">
              <Td>{categoryName(room)}</Td>
              <Td>{room.rooms}</Td>
              <Td>{room.occupancy}%</Td>
              <Td>{euro(room.current)}</Td>
              <Td>{euro(room.recommended)}</Td>
              <Td>{room.share}%</Td>
            </tr>
          ))}
          {budget.categories.length > 0 ? (
            <tr className="bg-[#F3F4F6] font-bold">
              <Td strong>{t.total}</Td>
              <Td strong>{totalRooms}</Td>
              <Td strong>{categoryOccupancy}%</Td>
              <Td>–</Td>
              <Td>–</Td>
              <Td strong>100%</Td>
            </tr>
          ) : (
            <tr>
              <td colSpan={6} className="px-3 py-4 text-[13px] text-[var(--qf-text-muted)]">{loading ? t.refreshing : t.emptyBudget}</td>
            </tr>
          )}
        </DataTable>
      </Card>
    </ForecastShell>
  );
}
