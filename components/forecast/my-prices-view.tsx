"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/i18n-provider";
import { Card, DataTable, ForecastShell, Td, useForecast } from "./forecast-ui";

type Row = {
  date: string;
  categoryId: string;
  category: string;
  ratePlan: string;
  pricePerPerson1: number | null;
  pricePerPerson2: number | null;
  roomPrice2Adults: number | null;
};

type Loaded = { plan: string; lastImportedAt: string | null; rows: Row[] };
type Imported = { imported: number; unmatched: string[]; startDate: string; endDate: string };

function money(value: number | null) {
  if (value === null) return "–";
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function localeTag(locale: string) {
  return locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB";
}

function dayText(date: string, locale: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(localeTag(locale), { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function stamp(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(localeTag(locale), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function MyPricesView() {
  const t = useForecast().myPrices;
  const { locale } = useI18n();
  const [data, setData] = useState<Loaded>({ plan: "", lastImportedAt: null, rows: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Imported | null>(null);

  async function load() {
    const response = await fetch("/api/my-prices", { cache: "no-store" });
    if (!response.ok) throw new Error("load");
    setData(await response.json() as Loaded);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/my-prices", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        return response.json() as Promise<Loaded>;
      })
      .then((loaded) => {
        if (active) setData(loaded);
      })
      .catch(() => {
        if (active) setError(t.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t.loadFailed]);

  async function refresh() {
    setRefreshing(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/my-prices", { method: "POST" });
      const body = await response.json().catch(() => null) as (Imported & { error?: string; detail?: string }) | null;
      if (!response.ok || !body || body.error) {
        const text = body?.error === "RATES_FILE_NOT_FOUND" ? t.notFound : body?.error === "RATES_FILE_INVALID" ? t.invalid : t.failed;
        setError(body?.detail ? `${text} (${body.detail})` : text);
        return;
      }
      setResult(body);
      await load();
    } catch {
      setError(t.failed);
    } finally {
      setRefreshing(false);
    }
  }

  const dates = useMemo(() => [...new Set(data.rows.map((row) => row.date))], [data.rows]);
  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of data.rows) if (!seen.has(row.categoryId)) seen.set(row.categoryId, row.category);
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data.rows]);
  const cell = useMemo(() => new Map(data.rows.map((row) => [`${row.date}|${row.categoryId}`, row])), [data.rows]);

  return (
    <ForecastShell activeItem="myPrices">
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <p className="min-w-[220px] flex-1 text-[12.5px] text-[var(--qf-text-muted)]">{t.intro.replace("{plan}", data.plan || "TAG_HP")}</p>
        <span className="text-[12.5px] text-[var(--qf-text-muted)]">
          {t.lastImported}: <b className="text-[var(--qf-text)]">{data.lastImportedAt ? stamp(data.lastImportedAt, locale) : t.never}</b>
        </span>
        <button type="button" onClick={() => void refresh()} disabled={refreshing || loading} className="cursor-pointer rounded-[7px] bg-[var(--qf-accent)] px-3.5 py-[7px] text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
          {refreshing ? t.refreshing : t.refresh}
        </button>
      </div>
      {error ? <p role="alert" className="mb-3.5 text-[12px] text-[#DC2626]">{error}</p> : null}
      {result ? (
        <div className="mb-3.5 text-[12px]">
          <p className="text-[#16A34A]">{t.done.replace("{count}", String(result.imported)).replace("{from}", result.startDate).replace("{to}", result.endDate)}</p>
          {result.unmatched.length ? <p className="mt-1 text-[#D97706]">{t.unmatched.replace("{codes}", result.unmatched.join(", "))}</p> : null}
        </div>
      ) : null}

      {!loading && data.rows.length === 0 ? <p className="text-[13px] text-[var(--qf-text-muted)]">{t.empty}</p> : null}

      {data.rows.length ? (
        <div className="flex flex-col gap-[18px]">
          <Card title={`💶 ${t.matrixTitle}`} flush>
            <DataTable headers={[{ label: t.date }, ...categories.map((category) => ({ label: category.name, align: "right" as const }))]}>
              {dates.map((date) => (
                <tr key={date} className="group">
                  <Td strong>{dayText(date, locale)}</Td>
                  {categories.map((category) => {
                    const row = cell.get(`${date}|${category.id}`);
                    // A single room has no 2-person price, so its 1-person price is shown (marked "(1)") instead of a dash.
                    const single = row && row.roomPrice2Adults === null ? row.pricePerPerson1 : null;
                    return <Td key={category.id} align="right" muted={!row || row.roomPrice2Adults === null}>{single !== null ? <>{money(single)} <span className="text-[10px]">(1)</span></> : money(row?.roomPrice2Adults ?? null)}</Td>;
                  })}
                </tr>
              ))}
            </DataTable>
          </Card>

          <Card title={`📋 ${t.detailTitle}`} flush>
            <p className="px-5 pt-3 text-[12px] text-[var(--qf-text-muted)]">{t.detailHint}</p>
            <DataTable headers={[{ label: t.date }, { label: t.category }, { label: t.plan }, { label: t.perPerson1, align: "right" }, { label: t.perPerson2, align: "right" }, { label: t.room2, align: "right" }]}>
              {data.rows.map((row) => (
                <tr key={`${row.date}|${row.categoryId}`} className="group">
                  <Td>{dayText(row.date, locale)}</Td>
                  <Td>{row.category}</Td>
                  <Td muted>{row.ratePlan}</Td>
                  <Td align="right" muted={row.pricePerPerson1 === null}>{money(row.pricePerPerson1)}</Td>
                  <Td align="right" muted={row.pricePerPerson2 === null}>{money(row.pricePerPerson2)}</Td>
                  <Td align="right" strong muted={row.roomPrice2Adults === null}>{money(row.roomPrice2Adults)}</Td>
                </tr>
              ))}
            </DataTable>
          </Card>
        </div>
      ) : null}
    </ForecastShell>
  );
}
