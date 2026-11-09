"use client";

import { useEffect, useState } from "react";
import { AiBanner, Card, Chip, DataTable, ForecastShell, Kpi, Td, useForecast } from "./forecast-ui";
import { useI18n } from "../i18n/i18n-provider";

type Status = "urgent" | "adjust" | "optimal";

type Summary = { en: string; de: string; it: string };
type Row = {
  date: string;
  occupancy: number;
  current: number | null;
  recommended: number | null;
  competitorAvg: number | null;
  status: Status;
  adopted: boolean;
};

const tone = { urgent: "red", adjust: "amber", optimal: "green" } as const;
const dayKeys = ["su", "mo", "tu", "we", "th", "fr", "sa"] as const;

function shortDate(iso: string) {
  const [, month, day] = iso.split("-");
  return `${day}.${month}.`;
}

function euro(value: number | null) {
  if (value === null) return "–";
  return `${Math.round(value)}€`;
}

export function RecommendationsView() {
  const t = useForecast().recommendations;
  const { locale } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary>({ en: "", de: "", it: "" });
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/revenue/recommendations")
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        return response.json() as Promise<{ generatedAt: string | null; rows: Row[]; summary?: Summary }>;
      })
      .then((data) => {
        if (!active) return;
        setRows(data.rows ?? []);
        setGeneratedAt(data.generatedAt ?? null);
        setSummary(data.summary ?? { en: "", de: "", it: "" });
      })
      .catch(() => {
        if (!active) return;
        setRows([]);
        setGeneratedAt(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const calculated = generatedAt
    ? t.lastCalculatedAt.replace("{when}", new Date(generatedAt).toLocaleString(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB", { dateStyle: "medium", timeStyle: "short" }))
    : t.notCalculated;

  function setAdopted(date: string, adopted: boolean) {
    const previous = rows;
    setRows((current) => current.map((row) => row.date === date ? { ...row, adopted } : row));
    fetch("/api/revenue/recommendations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, adopted }),
    }).then((response) => {
      if (!response.ok) setRows(previous);
    }).catch(() => setRows(previous));
  }

  return (
    <ForecastShell activeItem="revenue">
      <AiBanner title={t.bannerTitle}>
        {(locale === "de" ? summary.de : locale === "it" ? summary.it : summary.en) || t.notCalculated}
      </AiBanner>
      <section className="mb-[22px] grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t.occupancy} value="78" suffix="%" sub={<><Chip tone="green">↑ +4%</Chip> {t.vsLastYear}</>} />
        <Kpi label={t.avgRate} value="318" suffix="→ 342€" sub={<Chip tone="amber">{t.potential}</Chip>} />
        <Kpi label={t.seasonForecast} value="1.42" suffix="Mio€" sub={<><Chip tone="green">≈ +8%</Chip> {t.aboveBudget}</>} />
        <Kpi label={t.marketPosition} value="#1" accent sub={t.ofHotels} />
      </section>
      <section>
        <Card title={t.dailyTitle} action={loading ? t.lastCalculated : calculated} flush>
          <DataTable headers={[{ label: t.date }, { label: t.day }, { label: t.occupancyCol }, { label: t.current }, { label: t.aiRecommendation }, { label: t.competitorAvg }, { label: t.status }, { label: t.adopted, align: "center" }]}>
            {rows.map((row) => {
              const day = dayKeys[new Date(`${row.date}T00:00:00.000Z`).getUTCDay()];
              return (
                <tr key={row.date} className="group">
                  <Td>{shortDate(row.date)}</Td>
                  <Td>{t.days[day]}</Td>
                  <Td>{row.occupancy}%</Td>
                  <Td>{euro(row.current)}</Td>
                  <Td strong>{euro(row.recommended)}</Td>
                  <Td>{euro(row.competitorAvg)}</Td>
                  <Td><Chip tone={tone[row.status]}>{t[row.status]}</Chip></Td>
                  <Td align="center">
                    <input
                      type="checkbox"
                      checked={row.adopted}
                      aria-label={`${t.adopted} ${shortDate(row.date)}`}
                      onChange={(event) => setAdopted(row.date, event.target.checked)}
                    />
                  </Td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-[13px] text-[var(--qf-text-muted)]">{t.emptyDaily}</td>
              </tr>
            ) : null}
          </DataTable>
        </Card>
      </section>
    </ForecastShell>
  );
}
