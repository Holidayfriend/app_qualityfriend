"use client";

import { useState } from "react";
import { AiBanner, Card, Chip, DataTable, ForecastShell, Kpi, Td, useForecast } from "./forecast-ui";

const rows = [
  { date: "22.08.", day: "sa", occ: "92%", current: "380€", rec: "420€", avg: "401€", status: "urgent", adopted: false },
  { date: "23.08.", day: "su", occ: "88%", current: "360€", rec: "395€", avg: "388€", status: "adjust", adopted: false },
  { date: "24.08.", day: "mo", occ: "61%", current: "280€", rec: "275€", avg: "279€", status: "optimal", adopted: true },
  { date: "25.08.", day: "tu", occ: "58%", current: "275€", rec: "270€", avg: "268€", status: "optimal", adopted: true },
  { date: "26.08.", day: "we", occ: "64%", current: "280€", rec: "285€", avg: "291€", status: "adjust", adopted: false },
  { date: "27.08.", day: "th", occ: "71%", current: "300€", rec: "312€", avg: "305€", status: "adjust", adopted: false },
  { date: "28.08.", day: "fr", occ: "85%", current: "340€", rec: "375€", avg: "360€", status: "urgent", adopted: false },
  { date: "29.08.", day: "sa", occ: "95%", current: "380€", rec: "435€", avg: "410€", status: "urgent", adopted: false },
] as const;

const tone = { urgent: "red", adjust: "amber", optimal: "green" } as const;

export function RecommendationsView() {
  const t = useForecast().recommendations;
  const [adopted, setAdopted] = useState(rows.map((row) => row.adopted));
  return (
    <ForecastShell activeItem="revenue">
      <AiBanner title={t.bannerTitle}>
        {t.bannerBefore}<strong className="font-bold">{t.bannerAmount}</strong>{t.bannerAfter}
      </AiBanner>
      <section className="mb-[22px] grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t.occupancy} value="78" suffix="%" sub={<><Chip tone="green">↑ +4%</Chip> {t.vsLastYear}</>} />
        <Kpi label={t.avgRate} value="318" suffix="→ 342€" sub={<Chip tone="amber">{t.potential}</Chip>} />
        <Kpi label={t.seasonForecast} value="1.42" suffix="Mio€" sub={<><Chip tone="green">≈ +8%</Chip> {t.aboveBudget}</>} />
        <Kpi label={t.marketPosition} value="#1" accent sub={t.ofHotels} />
      </section>
      <section className="grid grid-cols-1 gap-[18px] xl:grid-cols-2">
        <Card title={t.dailyTitle} action={t.lastCalculated} flush>
          <DataTable headers={[{ label: t.date }, { label: t.day }, { label: t.occupancyCol }, { label: t.current }, { label: t.aiRecommendation }, { label: t.competitorAvg }, { label: t.status }, { label: t.adopted, align: "center" }]}>
            {rows.map((row, index) => (
              <tr key={row.date} className="group">
                <Td>{row.date}</Td>
                <Td>{t.days[row.day]}</Td>
                <Td>{row.occ}</Td>
                <Td>{row.current}</Td>
                <Td strong>{row.rec}</Td>
                <Td>{row.avg}</Td>
                <Td><Chip tone={tone[row.status]}>{t[row.status]}</Chip></Td>
                <Td align="center">
                  <input
                    type="checkbox"
                    checked={adopted[index]}
                    aria-label={`${t.adopted} ${row.date}`}
                    onChange={(event) => setAdopted((current) => current.map((value, item) => item === index ? event.target.checked : value))}
                  />
                </Td>
              </tr>
            ))}
          </DataTable>
        </Card>
        <Card title={t.insights}>
          <Insight icon="🔴" tone="red" title={t.underpriced} meta={t.underpricedMeta} badge={t.underpricedValue} badgeTone="red" />
          <Insight icon="✅" tone="green" title={t.gapStable} meta={t.gapStableMeta} />
          <Insight icon="📊" tone="blue" title={t.bookingPace} meta={t.bookingPaceMeta} />
        </Card>
      </section>
    </ForecastShell>
  );
}

function Insight({ icon, tone, title, meta, badge, badgeTone }: { icon: string; tone: "red" | "green" | "blue"; title: string; meta: string; badge?: string; badgeTone?: "red" }) {
  const bg = tone === "red" ? "bg-[#FEE2E2]" : tone === "green" ? "bg-[#DCFCE7]" : "bg-[#DBEAFE]";
  return (
    <article className="flex items-start gap-3 border-b border-[var(--qf-border)] py-[11px] last:border-0">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[15px] ${bg}`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[13.5px] font-semibold leading-[1.3]">{title}</h3>
        <p className="mt-0.5 text-[12px] text-[var(--qf-text-muted)]">{meta}</p>
      </div>
      {badge ? <span className={`shrink-0 rounded-[5px] px-2 py-[3px] text-[11px] font-semibold ${badgeTone === "red" ? "bg-[#FEE2E2] text-[#DC2626]" : ""}`}>{badge}</span> : null}
    </article>
  );
}
