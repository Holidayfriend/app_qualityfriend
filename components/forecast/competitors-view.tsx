"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "../i18n/i18n-provider";
import { AiBanner, Card, DataTable, ForecastShell, Td, useForecast } from "./forecast-ui";

type Hotel = {
  id: string;
  name: string;
  own: boolean;
  rating: number | null;
  reviewCount: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  adr: number | null;
  stars: number | null;
  distanceKm: number | null;
  url: string;
  fetchedAt: string;
  daily?: Array<{ date: string; minPrice: number | null; maxPrice: number | null; adr: number | null }>;
};

function dayText(date: string, locale: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function moneyText(value: number | null) {
  if (value === null) return "–";
  return `${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function rangeText(min: number | null, max: number | null) {
  if (min === null && max === null) return "–";
  if (min === null || max === null || min === max) return moneyText(min ?? max);
  return `${moneyText(min)} – ${moneyText(max)}`;
}

function starText(count: number | null) {
  if (!count) return "";
  return `${"★".repeat(count)}${"☆".repeat(5 - count)}`;
}

function formatUpdated(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function priceError(code: string | undefined, t: ReturnType<typeof useForecast>["competitors"], missing?: string[]) {
  if (code === "INVALID_POSITION" || missing?.includes("POSITION")) return t.missingPosition;
  if (code === "CREDENTIALS_MISSING") return t.credentialsMissing;
  if (code === "MISSING_FIELDS" && missing?.includes("LOCATION_ID")) return t.missingLocation;
  if (code === "MISSING_FIELDS") return t.missingAccount;
  return t.scrapeFailed;
}

type Summary = { en: string; de: string; it: string };

export function CompetitorsView() {
  const t = useForecast().competitors;
  const { locale } = useI18n();
  const [summary, setSummary] = useState<Summary>({ en: "", de: "", it: "" });
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxKm, setMaxKm] = useState("");
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Hotel | "new" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftAdr, setDraftAdr] = useState("");
  const [draftKm, setDraftKm] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [openDays, setOpenDays] = useState<string | null>(null);

  function reload() {
    return fetch("/api/competitors")
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        return response.json() as Promise<{ hotels: Hotel[]; summary?: Summary }>;
      })
      .then((data) => {
        setHotels(data.hotels ?? []);
        setSummary(data.summary ?? { en: "", de: "", it: "" });
      });
  }

  useEffect(() => {
    let active = true;
    reload()
      .catch(() => {
        if (active) setHotels([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const min = minPrice === "" ? null : Number(minPrice);
    const max = maxPrice === "" ? null : Number(maxPrice);
    const km = maxKm === "" ? null : Number(maxKm);
    return hotels.filter((hotel) => {
      if (query && !hotel.name.toLowerCase().includes(query.toLowerCase())) return false;
      const low = hotel.minPrice ?? hotel.maxPrice;
      const high = hotel.maxPrice ?? hotel.minPrice;
      if (min !== null && (high === null || high < min)) return false;
      if (max !== null && (low === null || low > max)) return false;
      if (km !== null && (hotel.distanceKm === null || hotel.distanceKm > km)) return false;
      return true;
    });
  }, [hotels, maxKm, maxPrice, minPrice, query]);

  const tracked = useMemo(() => visible.filter((hotel) => !hotel.own), [visible]);
  const lastUpdated = useMemo(() => {
    const times = hotels.map((hotel) => Date.parse(hotel.fetchedAt)).filter((time) => Number.isFinite(time));
    return times.length ? new Date(Math.max(...times)).toISOString() : "";
  }, [hotels]);

  function openNew() {
    setEditor("new");
    setDraftName("");
    setDraftAdr("");
    setDraftKm("");
    setDraftUrl("");
    setError("");
  }

  function openEdit(hotel: Hotel) {
    setEditor(hotel);
    setDraftName(hotel.name);
    setDraftAdr(hotel.adr === null ? "" : String(hotel.adr));
    setDraftKm(hotel.distanceKm === null ? "" : String(hotel.distanceKm));
    setDraftUrl(hotel.url);
    setError("");
  }

  async function save() {
    if (!draftName.trim()) {
      setError(t.required);
      return;
    }
    const price = draftAdr.trim() === "" ? null : Number(draftAdr.replace(",", "."));
    const distanceKm = draftKm.trim() === "" ? null : Number(draftKm.replace(",", "."));
    if ((price !== null && !Number.isFinite(price)) || (distanceKm !== null && !Number.isFinite(distanceKm))) {
      setError(t.invalidPosition);
      return;
    }
    setSaving(true);
    setError("");
    const editing = editor !== "new" ? editor : null;
    const body = {
      name: draftName.trim(),
      url: draftUrl.trim(),
      adr: price,
      distanceKm,
    };
    const response = await fetch(editing ? `/api/competitors/${editing.id}` : "/api/competitors", {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null) as { error?: string } | null;
    setSaving(false);
    if (!response.ok) {
      setError(data?.error === "MISSING_LOCATION_ID" ? t.missingLocation : t.lookupFailed);
      return;
    }
    await reload().catch(() => undefined);
    setEditor(null);
  }

  async function updatePrices() {
    setUpdating(true);
    setUpdateError("");
    try {
      const settingsResponse = await fetch("/api/competitors/settings");
      const settings = await settingsResponse.json().catch(() => null) as { latitude?: number | null; longitude?: number | null; mustInclude?: string[] } | null;
      if (!settingsResponse.ok || !settings || settings.latitude == null || settings.longitude == null) {
        setUpdateError(t.missingPosition);
        return;
      }
      const response = await fetch("/api/competitors/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: settings.latitude,
          longitude: settings.longitude,
          mustInclude: settings.mustInclude ?? [],
          pricesOnly: true,
        }),
      });
      const data = await response.json().catch(() => null) as { error?: string; missing?: string[] } | null;
      if (!response.ok || data?.error) {
        setUpdateError(priceError(data?.error, t, data?.missing));
        return;
      }
      await reload().catch(() => undefined);
    } catch {
      setUpdateError(t.scrapeFailed);
    } finally {
      setUpdating(false);
    }
  }

  async function remove(hotel: Hotel) {
    const response = await fetch(`/api/competitors/${hotel.id}`, { method: "DELETE" });
    if (!response.ok) return;
    setHotels((current) => current.filter((item) => item.id !== hotel.id));
  }

  return (
    <ForecastShell activeItem="competitors">
      <AiBanner title={t.bannerTitle}>{(locale === "de" ? summary.de : locale === "it" ? summary.it : summary.en) || t.summaryEmpty}</AiBanner>
      <section className="mb-[18px] grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {loading ? <p className="text-[13px] text-[var(--qf-text-muted)]">{t.loading}</p> : null}
        {!loading && visible.length === 0 ? <p className="text-[13px] text-[var(--qf-text-muted)]">{t.empty}</p> : null}
        {visible.map((hotel) => (
          <article key={hotel.id} className={`rounded-[10px] bg-white p-4 shadow-[var(--qf-shadow)] ${hotel.own ? "border-2 border-[var(--qf-accent)]" : "border border-[var(--qf-border)]"}`}>
            <h2 className={`mb-1 text-[14px] font-bold ${hotel.own ? "text-[var(--qf-accent)]" : ""}`}>{hotel.name}</h2>
            <div className="mb-1.5 flex items-center gap-2">
              {hotel.stars ? <span className="text-[13px] text-[#D97706]">{starText(hotel.stars)}</span> : null}
              <b>{hotel.rating ?? "–"}</b>
              <span className="text-[12px] text-[var(--qf-text-muted)]">{hotel.reviewCount ?? 0} {t.reviews}</span>
            </div>
            <p className="text-[13px] text-[var(--qf-text-muted)]">{rangeText(hotel.minPrice, hotel.maxPrice)}</p>
            <p className="mt-1 text-[12px] text-[var(--qf-text-muted)]">{hotel.distanceKm === null ? "–" : `${hotel.distanceKm.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`}</p>
            <p className="mt-2 text-[12px] text-[var(--qf-text-muted)]">{t.priceUpdated}: {formatUpdated(hotel.fetchedAt, locale)}</p>
          </article>
        ))}
      </section>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} className="w-full max-w-[220px] rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--qf-accent)]" />
        <input value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder={t.minPrice} aria-label={t.minPrice} inputMode="decimal" className="w-full max-w-[130px] rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--qf-accent)]" />
        <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder={t.maxPrice} aria-label={t.maxPrice} inputMode="decimal" className="w-full max-w-[130px] rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--qf-accent)]" />
        <input value={maxKm} onChange={(event) => setMaxKm(event.target.value)} placeholder={t.distance} aria-label={t.distance} inputMode="decimal" className="w-full max-w-[130px] rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--qf-accent)]" />
        <span className="ml-auto text-[12.5px] text-[var(--qf-text-muted)]">{lastUpdated ? `${t.updated}: ${formatUpdated(lastUpdated, locale)}` : ""}</span>
        <Link href="/competitors/settings" className="rounded-[7px] border border-[var(--qf-border)] px-3.5 py-[7px] text-[13px] font-semibold text-[var(--qf-text)]">{t.settingsTitle}</Link>
        <button type="button" onClick={() => void updatePrices()} disabled={updating || loading} className="cursor-pointer rounded-[7px] border border-[var(--qf-border)] px-3.5 py-[7px] text-[13px] font-semibold text-[var(--qf-text)] disabled:cursor-not-allowed disabled:opacity-60">{updating ? t.updatingPrices : t.updatePrices}</button>
        <button type="button" onClick={openNew} className="cursor-pointer rounded-[7px] bg-[var(--qf-accent)] px-3.5 py-[7px] text-[13px] font-semibold text-white">{t.addHotel}</button>
      </div>
      {updateError ? <p role="alert" className="mb-3.5 text-[12px] text-[#DC2626]">{updateError}</p> : null}
      <Card title={t.tracked} flush>
        <DataTable headers={[{ label: t.hotel }, { label: t.minPrice }, { label: t.maxPrice }, { label: t.adr }, { label: t.distanceCol }, { label: t.ratingLead }, { label: t.actions, align: "right" }]}>
          {tracked.length === 0 ? <tr><td colSpan={7} className="px-3 py-4 text-[13px] text-[var(--qf-text-muted)]">{t.empty}</td></tr> : tracked.flatMap((hotel) => [
            <tr key={hotel.id} className="group">
              <Td>
                {hotel.name}
                <button type="button" onClick={() => setOpenDays((current) => (current === hotel.id ? null : hotel.id))} aria-expanded={openDays === hotel.id} className="mt-0.5 block cursor-pointer text-[12px] font-semibold text-[var(--qf-accent)] hover:underline">
                  {openDays === hotel.id ? t.hideDays : t.nextDays} {openDays === hotel.id ? "▴" : "▾"}
                </button>
              </Td>
              <Td muted={hotel.minPrice === null}>{moneyText(hotel.minPrice)}</Td>
              <Td muted={hotel.maxPrice === null}>{moneyText(hotel.maxPrice)}</Td>
              <Td muted={hotel.adr === null}>{moneyText(hotel.adr)}</Td>
              <Td>{hotel.distanceKm === null ? "–" : `${hotel.distanceKm.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`}</Td>
              <Td>{hotel.rating ?? "–"}</Td>
              <Td align="right">
                <button type="button" aria-label={t.edit} title={t.edit} onClick={() => openEdit(hotel)} className="mr-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] border border-[var(--qf-border)] bg-white text-[12px] text-[var(--qf-text-muted)] hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]">✏️</button>
                <button type="button" aria-label={t.remove} title={t.remove} onClick={() => remove(hotel)} className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] border border-[var(--qf-border)] bg-white text-[12px] text-[var(--qf-text-muted)] hover:border-[#DC2626] hover:text-[#DC2626]">🗑️</button>
              </Td>
            </tr>,
            ...(openDays === hotel.id ? [
              <tr key={`${hotel.id}-days`}>
                <td colSpan={7} className="bg-[#FAF9F7] px-4 py-3">
                  <p className="mb-2 text-[12px] text-[var(--qf-text-muted)]">{t.daysHint}</p>
                  {hotel.daily?.length ? (
                    <table className="w-full max-w-[560px] text-[12.5px]">
                      <thead>
                        <tr className="text-left text-[var(--qf-text-muted)]">
                          <th className="py-1 pr-3 font-semibold">{t.date}</th>
                          <th className="py-1 pr-3 font-semibold">{t.minPrice}</th>
                          <th className="py-1 pr-3 font-semibold">{t.maxPrice}</th>
                          <th className="py-1 font-semibold">{t.adr}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hotel.daily.map((day) => (
                          <tr key={day.date} className="border-t border-[var(--qf-border)]">
                            <td className="py-1 pr-3">{dayText(day.date, locale)}</td>
                            <td className="py-1 pr-3">{moneyText(day.minPrice)}</td>
                            <td className="py-1 pr-3">{moneyText(day.maxPrice)}</td>
                            <td className="py-1">{moneyText(day.adr)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <p className="text-[12.5px] text-[var(--qf-text-muted)]">{t.noDays}</p>}
                </td>
              </tr>,
            ] : []),
          ])}
        </DataTable>
      </Card>
      {editor ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="forecast-hotel-title">
          <form className="w-full max-w-[440px] rounded-[12px] bg-white shadow-[0_20px_60px_rgba(0,0,0,.25)]" onSubmit={(event) => { event.preventDefault(); void save(); }}>
            <header className="flex items-center justify-between border-b border-[var(--qf-border)] px-[22px] py-[18px]">
              <h2 id="forecast-hotel-title" className="text-[15px] font-bold">{editor === "new" ? t.addHotel : t.editTitle}</h2>
              <button type="button" onClick={() => setEditor(null)} className="cursor-pointer text-[16px] text-[var(--qf-text-muted)]" aria-label={t.cancel}>✕</button>
            </header>
            <div className="flex flex-col gap-3.5 px-[22px] py-5">
              <p className="text-[12.5px] text-[var(--qf-text-muted)]">{t.editHint}</p>
              <label className="block text-[12px] font-semibold text-[var(--qf-text-muted)]">{t.name}
                <input value={draftName} onChange={(event) => setDraftName(event.target.value)} className="mt-[5px] w-full rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] font-normal text-[var(--qf-text)] outline-none focus:border-[var(--qf-accent)]" />
              </label>
              <label className="block text-[12px] font-semibold text-[var(--qf-text-muted)]">{t.adr}
                <input value={draftAdr} onChange={(event) => setDraftAdr(event.target.value)} inputMode="decimal" className="mt-[5px] w-full rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] font-normal text-[var(--qf-text)] outline-none focus:border-[var(--qf-accent)]" />
              </label>
              <label className="block text-[12px] font-semibold text-[var(--qf-text-muted)]">{t.distance}
                <input value={draftKm} onChange={(event) => setDraftKm(event.target.value)} inputMode="decimal" className="mt-[5px] w-full rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] font-normal text-[var(--qf-text)] outline-none focus:border-[var(--qf-accent)]" />
              </label>
              <label className="block text-[12px] font-semibold text-[var(--qf-text-muted)]">{t.url}
                <input value={draftUrl} onChange={(event) => setDraftUrl(event.target.value)} className="mt-[5px] w-full rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] font-normal text-[var(--qf-text)] outline-none focus:border-[var(--qf-accent)]" />
              </label>
              {error ? <p role="alert" className="text-[12px] text-[#DC2626]">{error}</p> : null}
            </div>
            <footer className="flex justify-end gap-2.5 border-t border-[var(--qf-border)] px-[22px] py-4">
              <button type="button" onClick={() => setEditor(null)} className="cursor-pointer rounded-[7px] border border-[var(--qf-border)] px-3.5 py-[7px] text-[13px] font-semibold text-[var(--qf-text-muted)]">{t.cancel}</button>
              <button type="submit" disabled={saving} className="cursor-pointer rounded-[7px] bg-[var(--qf-accent)] px-3.5 py-[7px] text-[13px] font-semibold text-white disabled:opacity-60">{t.save}</button>
            </footer>
          </form>
        </div>
      ) : null}
    </ForecastShell>
  );
}
