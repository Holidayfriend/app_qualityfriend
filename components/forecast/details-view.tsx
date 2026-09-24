"use client";

import { Card, DataTable, ForecastShell, Td, useForecast } from "./forecast-ui";

export function DetailsView() {
  const t = useForecast().details;
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
