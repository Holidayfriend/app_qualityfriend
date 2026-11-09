"use client";

import { useEffect, useState } from "react";
import { AiBanner, Card, Chip, DataTable, ForecastShell, Kpi, Td, useForecast } from "./forecast-ui";
import { useI18n } from "../i18n/i18n-provider";

type Status = "urgent" | "adjust" | "optimal";

type Summary = { en: string; de: string; it: string };
type Overview = {
  occupancy: number;
  occupancyVsLastYear: number;
  current: number | null;
  recommended: number | null;
  seasonRevenue: number;
  seasonVsLastYear: number | null;
};
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

function seasonAmount(value: number, locale: string) {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB", { maximumFractionDigits: 0 }).format(value);
}

function gapAmount(current: number | null, recommended: number | null) {
  if (current == null || recommended == null) return "–";
  const gap = Math.round(recommended - current);
  return `${gap > 0 ? "+" : ""}${gap}€`.replace("-", "−");
}

function gapTone(current: number | null, recommended: number | null) {
  if (current == null || recommended == null || recommended === current) return "amber" as const;
  return recommended > current ? "amber" as const : "red" as const;
}

function ChangeChip({ value }: { value: number | null }) {
  if (value == null) return <Chip tone="amber">–</Chip>;
  const rounded = Math.round(value * 10) / 10;
  const text = `${rounded > 0 ? "+" : ""}${rounded}%`.replace("-", "−");
  return <Chip tone={rounded > 0 ? "green" : rounded < 0 ? "red" : "amber"}>{text}</Chip>;
}

export function RecommendationsView() {
  const t = useForecast().recommendations;
  const { locale } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary>({ en: "", de: "", it: "" });
  const [overview, setOverview] = useState<Overview | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/revenue/recommendations")
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        return response.json() as Promise<{ generatedAt: string | null; rows: Row[]; summary?: Summary; overview?: Overview | null }>;
      })
      .then((data) => {
        if (!active) return;
        setRows(data.rows ?? []);
        setGeneratedAt(data.generatedAt ?? null);
        setSummary(data.summary ?? { en: "", de: "", it: "" });
        setOverview(data.overview ?? null);
      })
      .catch(() => {
        if (!active) return;
        setRows([]);
        setGeneratedAt(null);
        setOverview(null);
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
      <section className="mb-[22px] grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Kpi label={t.occupancy} value={overview ? String(overview.occupancy) : "–"} suffix={overview ? "%" : undefined} sub={overview ? <><ChangeChip value={overview.occupancyVsLastYear} /> {t.vsLastYear}</> : t.notCalculated} />
        <Kpi label={t.avgRate} value={overview?.current == null ? "–" : String(Math.round(overview.current))} suffix={overview?.recommended == null ? undefined : `→ ${Math.round(overview.recommended)}€`} sub={overview ? <Chip tone={gapTone(overview.current, overview.recommended)}>{t.potential.replace("{amount}", gapAmount(overview.current, overview.recommended))}</Chip> : t.notCalculated} />
        <Kpi label={t.seasonForecast} value={overview ? seasonAmount(overview.seasonRevenue, locale) : "–"} suffix={overview ? "€" : undefined} sub={overview ? <><ChangeChip value={overview.seasonVsLastYear} /> {t.vsLastYear}</> : t.notCalculated} />
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
