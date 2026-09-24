"use client";

import { useMemo, useState } from "react";
import { AiBanner, Card, Chip, DataTable, ForecastShell, Kpi, Td, useForecast } from "./forecast-ui";

type Hotel = { id: string; name: string; adr: number | null; km: number; updated: "ago2h" | "ago6h" | "ago3d" | "ago5d"; ok: boolean; url: string };

const seed: Hotel[] = [
  { id: "wolfs", name: "Hotel Am Wolfsgrubenersee", adr: 305.5, km: 0.24, updated: "ago2h", ok: true, url: "" },
  { id: "birken", name: "Drei Birken", adr: 174, km: 0.48, updated: "ago2h", ok: true, url: "" },
  { id: "hang", name: "Hotel Am Hang", adr: 483, km: 0.6, updated: "ago2h", ok: true, url: "" },
  { id: "rinner", name: "Apipura – Hotel Rinner", adr: 327.5, km: 0.8, updated: "ago6h", ok: true, url: "" },
  { id: "cost", name: "Soggiorno Alpino Costalovara", adr: null, km: 0.84, updated: "ago3d", ok: false, url: "" },
  { id: "licht", name: "Hotel Lichtenstern", adr: 665.5, km: 1.28, updated: "ago2h", ok: true, url: "" },
  { id: "post", name: "Hotel Post Victoria", adr: null, km: 1.75, updated: "ago5d", ok: false, url: "" },
  { id: "adler", name: "Adler Lodge Ritten", adr: 1394.5, km: 1.92, updated: "ago2h", ok: true, url: "" },
];

const cards = [
  { name: "⭐ Weihrerhof", rating: "4.9", reviewsKey: "reviews" as const, count: 137, price: "392 – 597 €", stars: "★★★★★", tags: ["Family", "Trendy", "Romantic"], self: true },
  { name: "Hotel Am Hang", rating: "4.8", reviewsKey: "reviewsShort" as const, count: 69, price: "299 – 667 €", stars: "★★★★★", tags: ["Trendy", "Business"], up: true },
  { name: "Hotel Am Wolfsgrubenersee", rating: "4.5", reviewsKey: "reviewsShort" as const, count: 74, price: "319 – 369 €", stars: "★★★★☆", tags: ["Classic", "Lake View"] },
  { name: "Hotel Rinner", rating: "4.5", reviewsKey: "reviewsShort" as const, count: 94, price: "204 – 451 €", stars: "★★★★☆", tags: ["Mid-range", "Family"] },
  { name: "Hotel Birken", rating: "4.2", reviewsKey: "reviewsShort" as const, count: 64, price: "169 – 179 €", stars: "★★★★☆", tags: ["Budget", "Family"] },
];

function money(value: number) {
  return `${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function CompetitorsView() {
  const t = useForecast().competitors;
  const [hotels, setHotels] = useState(seed);
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [maxKm, setMaxKm] = useState("");
  const [editor, setEditor] = useState<Hotel | "new" | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftAdr, setDraftAdr] = useState("");
  const [draftKm, setDraftKm] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const min = minPrice === "" ? null : Number(minPrice);
    const max = maxPrice === "" ? null : Number(maxPrice);
    const km = maxKm === "" ? null : Number(maxKm);
    return hotels.filter((hotel) => {
      if (query && !hotel.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (min !== null && (hotel.adr === null || hotel.adr < min)) return false;
      if (max !== null && (hotel.adr === null || hotel.adr > max)) return false;
      if (km !== null && hotel.km > km) return false;
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
    setDraftKm(String(hotel.km));
    setDraftUrl(hotel.url);
    setError("");
  }

  function save() {
    if (!draftName.trim()) {
      setError(t.required);
      return;
    }
    const adr = draftAdr.trim() === "" ? null : Number(draftAdr.replace(",", "."));
    const km = draftKm.trim() === "" ? 0 : Number(draftKm.replace(",", "."));
    if (editor === "new") {
      setHotels((current) => [...current, { id: crypto.randomUUID(), name: draftName.trim(), adr: Number.isFinite(adr as number) ? adr : null, km: Number.isFinite(km) ? km : 0, updated: "ago2h", ok: true, url: draftUrl.trim() }]);
    } else if (editor) {
      setHotels((current) => current.map((hotel) => hotel.id === editor.id ? { ...hotel, name: draftName.trim(), adr: Number.isFinite(adr as number) ? adr : null, km: Number.isFinite(km) ? km : hotel.km, url: draftUrl.trim() } : hotel));
    }
    setEditor(null);
  }

  return (
    <ForecastShell activeItem="competitors">
      <AiBanner title={t.bannerTitle}>{t.bannerBody}</AiBanner>
      <section className="mb-[18px] grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Kpi label={t.rank} value="#1" accent sub={t.rankSub} />
        <Kpi label={t.advantage} value="+22" suffix="€" sub={t.advantageSub} />
        <Kpi label={t.ratingLead} value="+0.1" suffix="★" sub="4.9 vs. 4.8 (Am Hang)" />
      </section>
      <section className="mb-[18px] grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((hotel) => (
          <article key={hotel.name} className={`rounded-[10px] bg-white p-4 shadow-[var(--qf-shadow)] ${hotel.self ? "border-2 border-[var(--qf-accent)]" : "border border-[var(--qf-border)]"}`}>
            <div className="flex items-start justify-between gap-2">
              <h2 className={`mb-1 text-[14px] font-bold ${hotel.self ? "text-[var(--qf-accent)]" : ""}`}>{hotel.name}</h2>
              {hotel.self ? <span className="rounded-full bg-[var(--qf-accent-soft)] px-[9px] py-[3px] text-[12px] font-bold text-[var(--qf-accent)]">#1</span> : null}
            </div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[13px] text-[#D97706]">{hotel.stars}</span>
              <b>{hotel.rating}</b>
              <span className="text-[12px] text-[var(--qf-text-muted)]">{hotel.count} {t[hotel.reviewsKey]}</span>
            </div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[13px] text-[var(--qf-text-muted)]">{hotel.price}</span>
              {hotel.up ? <Chip tone="amber">{t.pricesUp}</Chip> : null}
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {hotel.tags.map((tag) => <span key={tag} className="rounded-[4px] bg-[#F3F4F6] px-[7px] py-0.5 text-[11px] text-[var(--qf-text-muted)]">{tag}</span>)}
            </div>
          </article>
        ))}
      </section>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} className="w-full max-w-[220px] rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--qf-accent)]" />
        <input value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder={t.minPrice} aria-label={t.minPrice} inputMode="decimal" className="w-full max-w-[130px] rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--qf-accent)]" />
        <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder={t.maxPrice} aria-label={t.maxPrice} inputMode="decimal" className="w-full max-w-[130px] rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--qf-accent)]" />
        <input value={maxKm} onChange={(event) => setMaxKm(event.target.value)} placeholder={t.distance} aria-label={t.distance} inputMode="decimal" className="w-full max-w-[130px] rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--qf-accent)]" />
        <button type="button" onClick={openNew} className="ml-auto cursor-pointer rounded-[7px] bg-[var(--qf-accent)] px-3.5 py-[7px] text-[13px] font-semibold text-white">{t.addHotel}</button>
      </div>
      <div className="mb-[18px]">
        <Card title={t.tracked} flush>
          <DataTable headers={[{ label: t.hotel }, { label: t.adr }, { label: t.distanceCol }, { label: t.updated }, { label: t.status }, { label: t.actions, align: "right" }]}>
            {visible.length === 0 ? <tr><td colSpan={6} className="px-3 py-4 text-[13px] text-[var(--qf-text-muted)]">{t.empty}</td></tr> : visible.map((hotel) => (
              <tr key={hotel.id} className="group">
                <Td>{hotel.name}</Td>
                <Td muted={hotel.adr === null}>{hotel.adr === null ? "–" : money(hotel.adr)}</Td>
                <Td>{hotel.km.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</Td>
                <Td>{t[hotel.updated]}</Td>
                <Td>{hotel.ok ? <Chip tone="green">{t.ok}</Chip> : <Chip tone="red">{t.failed}</Chip>}</Td>
                <Td align="right">
                  <button type="button" aria-label={t.edit} title={t.edit} onClick={() => openEdit(hotel)} className="mr-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] border border-[var(--qf-border)] bg-white text-[12px] text-[var(--qf-text-muted)] hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]">✏️</button>
                  <button type="button" aria-label={t.remove} title={t.remove} onClick={() => setHotels((current) => current.filter((item) => item.id !== hotel.id))} className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] border border-[var(--qf-border)] bg-white text-[12px] text-[var(--qf-text-muted)] hover:border-[#DC2626] hover:text-[#DC2626]">🗑️</button>
                </Td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>
      <Card title={t.reviewsTitle} action={<a href="https://www.tripadvisor.com" target="_blank" rel="noreferrer" className="text-[var(--qf-accent)]">{t.openTripadvisor}</a>}>
        <article className="flex items-start gap-3 border-b border-[var(--qf-border)] py-[11px]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#DBEAFE]">⭐</span>
          <div className="min-w-0 flex-1"><h3 className="text-[13.5px] font-semibold leading-[1.3]">{t.review1Title}</h3><p className="mt-0.5 text-[12px] text-[var(--qf-text-muted)]">{t.review1Body}</p></div>
          <span className="shrink-0 rounded-[5px] bg-[#DBEAFE] px-2 py-[3px] text-[11px] font-semibold text-[#2563EB]">{t.watch}</span>
        </article>
        <article className="flex items-start gap-3 py-[11px]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#FEE2E2]">⭐</span>
          <div className="min-w-0 flex-1"><h3 className="text-[13.5px] font-semibold leading-[1.3]">{t.review2Title}</h3><p className="mt-0.5 text-[12px] text-[var(--qf-text-muted)]">{t.review2Body}</p></div>
          <span className="shrink-0 rounded-[5px] bg-[#DCFCE7] px-2 py-[3px] text-[11px] font-semibold text-[#16A34A]">{t.chance}</span>
        </article>
      </Card>
      {editor ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="forecast-hotel-title">
          <form className="w-full max-w-[440px] rounded-[12px] bg-white shadow-[0_20px_60px_rgba(0,0,0,.25)]" onSubmit={(event) => { event.preventDefault(); save(); }}>
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
              <button type="submit" className="cursor-pointer rounded-[7px] bg-[var(--qf-accent)] px-3.5 py-[7px] text-[13px] font-semibold text-white">{t.save}</button>
            </footer>
          </form>
        </div>
      ) : null}
    </ForecastShell>
  );
}
