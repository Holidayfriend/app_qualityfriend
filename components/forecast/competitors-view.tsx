"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
};

function adrText(value: number | null) {
  if (value === null) return "–";
  return `${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function starText(count: number | null) {
  if (!count) return "";
  return `${"★".repeat(count)}${"☆".repeat(5 - count)}`;
}

export function CompetitorsView() {
  const t = useForecast().competitors;
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

  function reload() {
    return fetch("/api/competitors")
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        return response.json() as Promise<{ hotels: Hotel[] }>;
      })
      .then((data) => setHotels(data.hotels ?? []));
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
      const price = hotel.adr;
      if (min !== null && (price === null || price < min)) return false;
      if (max !== null && (price === null || price > max)) return false;
      if (km !== null && (hotel.distanceKm === null || hotel.distanceKm > km)) return false;
      return true;
    });
  }, [hotels, maxKm, maxPrice, minPrice, query]);

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

  async function remove(hotel: Hotel) {
    const response = await fetch(`/api/competitors/${hotel.id}`, { method: "DELETE" });
    if (!response.ok) return;
    setHotels((current) => current.filter((item) => item.id !== hotel.id));
  }

  return (
    <ForecastShell activeItem="competitors">
      <AiBanner title={t.bannerTitle}>{t.bannerBody}</AiBanner>
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
            <p className="text-[13px] text-[var(--qf-text-muted)]">{adrText(hotel.adr)}</p>
            <p className="mt-1 text-[12px] text-[var(--qf-text-muted)]">{hotel.distanceKm === null ? "–" : `${hotel.distanceKm.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`}</p>
          </article>
        ))}
      </section>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} className="w-full max-w-[220px] rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--qf-accent)]" />
        <input value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder={t.minPrice} aria-label={t.minPrice} inputMode="decimal" className="w-full max-w-[130px] rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--qf-accent)]" />
        <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder={t.maxPrice} aria-label={t.maxPrice} inputMode="decimal" className="w-full max-w-[130px] rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--qf-accent)]" />
        <input value={maxKm} onChange={(event) => setMaxKm(event.target.value)} placeholder={t.distance} aria-label={t.distance} inputMode="decimal" className="w-full max-w-[130px] rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--qf-accent)]" />
        <Link href="/competitors/settings" className="ml-auto rounded-[7px] border border-[var(--qf-border)] px-3.5 py-[7px] text-[13px] font-semibold text-[var(--qf-text)]">{t.settingsTitle}</Link>
        <button type="button" onClick={openNew} className="cursor-pointer rounded-[7px] bg-[var(--qf-accent)] px-3.5 py-[7px] text-[13px] font-semibold text-white">{t.addHotel}</button>
      </div>
      <Card title={t.tracked} flush>
        <DataTable headers={[{ label: t.hotel }, { label: t.adr }, { label: t.distanceCol }, { label: t.ratingLead }, { label: t.actions, align: "right" }]}>
          {visible.length === 0 ? <tr><td colSpan={5} className="px-3 py-4 text-[13px] text-[var(--qf-text-muted)]">{t.empty}</td></tr> : visible.map((hotel) => (
            <tr key={hotel.id} className="group">
              <Td strong={hotel.own}>{hotel.name}</Td>
              <Td muted={hotel.adr === null}>{adrText(hotel.adr)}</Td>
              <Td>{hotel.distanceKm === null ? "–" : `${hotel.distanceKm.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`}</Td>
              <Td>{hotel.rating ?? "–"}</Td>
              <Td align="right">
                <button type="button" aria-label={t.edit} title={t.edit} onClick={() => openEdit(hotel)} className="mr-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] border border-[var(--qf-border)] bg-white text-[12px] text-[var(--qf-text-muted)] hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]">✏️</button>
                <button type="button" aria-label={t.remove} title={t.remove} onClick={() => remove(hotel)} className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] border border-[var(--qf-border)] bg-white text-[12px] text-[var(--qf-text-muted)] hover:border-[#DC2626] hover:text-[#DC2626]">🗑️</button>
              </Td>
            </tr>
          ))}
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
