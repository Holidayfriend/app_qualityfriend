"use client";

import { useState } from "react";
import { useToast } from "../ui/toast-provider";
import { Card, DataTable, ForecastShell, Td, useForecast } from "./forecast-ui";

export function DetailsView() {
  const t = useForecast().details;
  const showToast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  async function refreshForecast() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const response = await fetch("/api/budget/refresh", { method: "POST" });
      const body = await response.json();
      if (response.status === 202 && body.status === "queued") showToast({ message: t.queued, tone: "success" });
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
      setRefreshing(false);
    }
  }
  const months = [
    { name: t.august, extra: t.running, occ: "89%", current: "352€", rec: "378€", revenue: "145.000€", yoy: "+9%", tone: "text-[#16A34A]" },
    { name: t.september, extra: "", occ: "81%", current: "335€", rec: "360€", revenue: "121.000€", yoy: "+15%", tone: "text-[#16A34A]" },
    { name: t.october, extra: "", occ: "68%", current: "295€", rec: "300€", revenue: "94.000€", yoy: "−5%", tone: "text-[#DC2626]" },
    { name: t.november, extra: "", occ: "52%", current: "265€", rec: "268€", revenue: "68.000€", yoy: "±0%", tone: "text-[var(--qf-text-muted)]" },
    { name: t.december, extra: "", occ: "84%", current: "340€", rec: "355€", revenue: "112.000€", yoy: "+12%", tone: "text-[#16A34A]" },
  ];
  const rooms = [
    { name: t.single, count: "4", occ: "95%", current: "262€", rec: "278€", share: "9%" },
    { name: t.comfort, count: "14", occ: "91%", current: "340€", rec: "362€", share: "39%" },
    { name: t.deluxe, count: "10", occ: "88%", current: "425€", rec: "458€", share: "34%" },
    { name: t.suite, count: "4", occ: "79%", current: "560€", rec: "597€", share: "18%" },
  ];
  return (
    <ForecastShell activeItem="budget">
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={() => void refreshForecast()} disabled={refreshing} aria-busy={refreshing} className="inline-flex items-center gap-2 rounded-[7px] border border-[var(--qf-border)] bg-white px-3 py-1.5 text-[12.5px] font-semibold disabled:cursor-wait disabled:opacity-60">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.55-2.1L20 8M4 16l2.35 3.1A7 7 0 0 0 17.9 17" /></svg>
          {refreshing ? t.refreshing : t.refreshForecast}
        </button>
      </div>
      <div className="mb-[18px]">
        <Card title={t.monthsTitle} action={t.monthsBasis} flush>
          <DataTable headers={[{ label: t.month }, { label: t.avgOccupancy }, { label: t.adrCurrent }, { label: t.adrRecommended }, { label: t.forecastRevenue }, { label: t.vsLastYear }]}>
            {months.map((month) => (
              <tr key={month.name} className="group">
                <Td strong>{month.name} {month.extra ? <span className="font-normal">{month.extra}</span> : null}</Td>
                <Td>{month.occ}</Td>
                <Td>{month.current}</Td>
                <Td>{month.rec}</Td>
                <Td>{month.revenue}</Td>
                <Td><span className={month.tone}>{month.yoy}</span></Td>
              </tr>
            ))}
            <tr className="bg-[#F3F4F6] font-bold">
              <Td strong>{t.totalSeason}</Td>
              <Td>71%</Td>
              <Td>–</Td>
              <Td>–</Td>
              <Td strong>395.000€</Td>
              <Td><span className="font-bold text-[#16A34A]">+8%</span></Td>
            </tr>
          </DataTable>
        </Card>
      </div>
      <Card title={t.roomsTitle} action={t.currentMonth} flush>
        <DataTable headers={[{ label: t.category }, { label: t.rooms }, { label: t.occupancy }, { label: t.adrCurrent }, { label: t.adrRecommended }, { label: t.revenueShare }]}>
          {rooms.map((room) => (
            <tr key={room.name} className="group">
              <Td>{room.name}</Td>
              <Td>{room.count}</Td>
              <Td>{room.occ}</Td>
              <Td>{room.current}</Td>
              <Td>{room.rec}</Td>
              <Td>{room.share}</Td>
            </tr>
          ))}
          <tr className="bg-[#F3F4F6] font-bold">
            <Td strong>{t.total}</Td>
            <Td strong>32</Td>
            <Td strong>89%</Td>
            <Td>–</Td>
            <Td>–</Td>
            <Td strong>100%</Td>
          </tr>
        </DataTable>
      </Card>
    </ForecastShell>
  );
}
