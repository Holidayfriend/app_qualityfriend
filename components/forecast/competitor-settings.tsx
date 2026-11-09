"use client";

import { useEffect, useState } from "react";
import { Card, useForecast } from "./forecast-ui";

type Settings = {
  latitude: number | null;
  longitude: number | null;
  locationCode: number | null;
  locationName: string | null;
  mustInclude: string[];
};

const empty: Settings = { latitude: null, longitude: null, locationCode: null, locationName: null, mustInclude: [] };

type ScrapeHotel = { name: string; distanceKm: number | null; minPrice: number | null; maxPrice: number | null; rating: number | null; reviewCount: number | null };
type ScrapeResult = { saved: number; mustHave: Array<{ name: string; found: boolean }>; hotels: ScrapeHotel[] };

export function CompetitorSettings() {
  const t = useForecast().competitors;
  const [settings, setSettings] = useState<Settings>(empty);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finding, setFinding] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scraped, setScraped] = useState<ScrapeResult | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/competitors/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("load");
        return response.json() as Promise<Settings>;
      })
      .then((data) => {
        if (!active) return;
        setSettings(data);
        setLatitude(data.latitude === null ? "" : String(data.latitude));
        setLongitude(data.longitude === null ? "" : String(data.longitude));
        setTags(data.mustInclude ?? []);
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

  function addTag() {
    const name = draft.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (tags.length >= 10) {
      setError(t.tagLimit);
      return;
    }
    if (tags.some((tag) => tag.toLowerCase() === name.toLowerCase())) {
      setError(t.duplicate);
      return;
    }
    setTags((current) => [...current, name]);
    setDraft("");
    setError("");
    setNotice("");
  }

  async function getLocationId() {
    setFinding(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/competitors/settings", { method: "POST" });
      const data = await response.json().catch(() => null) as { locationCode?: number | null; locationName?: string | null; error?: string } | null;
      if (!response.ok || data?.locationCode == null) {
        setError(message(data?.error, t));
        return;
      }
      setSettings((current) => ({ ...current, locationCode: data.locationCode ?? null, locationName: data.locationName ?? null }));
      setNotice(t.saved);
    } catch {
      setError(t.lookupFailed);
    } finally {
      setFinding(false);
    }
  }

  async function scrape() {
    setScraping(true);
    setError("");
    setNotice("");
    setScraped(null);
    try {
      const response = await fetch("/api/competitors/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, mustInclude: tags }),
      });
      const data = await response.json().catch(() => null) as (ScrapeResult & { error?: string; missing?: string[] }) | null;
      if (!response.ok || !data || data.error) {
        setError(message(data?.error, t, data?.missing));
        return;
      }
      setScraped(data);
      setNotice(t.saved);
    } catch {
      setError(t.scrapeFailed);
    } finally {
      setScraping(false);
    }
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/competitors/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, mustInclude: tags }),
      });
      const data = await response.json().catch(() => null) as (Settings & { error?: string }) | null;
      if (!response.ok) {
        setError(message(data?.error, t));
        return;
      }
      if (!data) return;
      setSettings(data);
      setLatitude(data.latitude === null ? "" : String(data.latitude));
      setLongitude(data.longitude === null ? "" : String(data.longitude));
      setTags(data.mustInclude ?? []);
      setNotice(t.saved);
    } catch {
      setError(t.lookupFailed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-[18px]">
      <Card title={t.settingsTitle}>
        <p className="mb-4 text-[12.5px] text-[var(--qf-text-muted)]">{t.settingsHint}</p>
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--qf-text-muted)]">{t.locationCode}
              <input value={settings.locationCode === null ? "" : String(settings.locationCode)} readOnly aria-label={t.locationCode} className="mt-[5px] w-full rounded-[7px] border border-[var(--qf-border)] bg-[#F9F8F6] px-3 py-[9px] text-[13.5px] font-normal text-[var(--qf-text)] outline-none" />
            </label>
            <button type="button" onClick={getLocationId} disabled={finding || loading} className="mt-2 cursor-pointer rounded-[7px] border border-[var(--qf-border)] px-3.5 py-[7px] text-[13px] font-semibold text-[var(--qf-text)] disabled:cursor-not-allowed disabled:opacity-60">{finding ? t.gettingLocation : t.getLocationId}</button>
          </div>
          <label className="block text-[12px] font-semibold text-[var(--qf-text-muted)]">{t.latitude}
            <input value={latitude} onChange={(event) => setLatitude(event.target.value)} inputMode="decimal" aria-label={t.latitude} className="mt-[5px] w-full rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] font-normal text-[var(--qf-text)] outline-none focus:border-[var(--qf-accent)]" />
          </label>
          <label className="block text-[12px] font-semibold text-[var(--qf-text-muted)]">{t.longitude}
            <input value={longitude} onChange={(event) => setLongitude(event.target.value)} inputMode="decimal" aria-label={t.longitude} className="mt-[5px] w-full rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] font-normal text-[var(--qf-text)] outline-none focus:border-[var(--qf-accent)]" />
          </label>
        </div>
        <div className="mt-4">
          <p className="text-[12px] font-semibold text-[var(--qf-text-muted)]">{t.mustInclude}</p>
          <p className="mt-1 text-[12px] text-[var(--qf-text-muted)]">{t.mustIncludeHint}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[12px]">
                {tag}
                <button type="button" aria-label={`${t.removeTag} ${tag}`} onClick={() => setTags((current) => current.filter((item) => item !== tag))} className="cursor-pointer text-[var(--qf-text-muted)] hover:text-[#DC2626]">×</button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag();
                }
              }}
              placeholder={t.tagPlaceholder}
              aria-label={t.tagPlaceholder}
              className="w-full max-w-[280px] rounded-[7px] border border-[var(--qf-border)] px-3 py-[9px] text-[13.5px] outline-none focus:border-[var(--qf-accent)]"
            />
            <button type="button" onClick={addTag} className="cursor-pointer rounded-[7px] border border-[var(--qf-border)] px-3.5 py-[7px] text-[13px] font-semibold text-[var(--qf-text)]">{t.addCompetitor}</button>
          </div>
        </div>
        {scraped ? (
          <div className="mt-4">
            <p className="text-[13px] font-semibold">{t.scraped}: {scraped.saved}</p>
            {scraped.mustHave.length ? (
              <ul className="mt-2 text-[12.5px]">
                {scraped.mustHave.map((item) => <li key={item.name}>{item.name}: {item.found ? t.found : t.notFound}</li>)}
              </ul>
            ) : null}
            <ul className="mt-2 max-h-64 overflow-auto text-[12.5px]">
              {scraped.hotels.map((hotel) => (
                <li key={hotel.name} className="border-b border-[var(--qf-border)] py-1.5">
                  {hotel.name} · {hotel.distanceKm === null ? "–" : `${hotel.distanceKm} km`} · {hotel.minPrice === null ? "–" : `${hotel.minPrice}–${hotel.maxPrice} €`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {error ? <p role="alert" className="mt-3 text-[12px] text-[#DC2626]">{error}</p> : null}
        {notice ? <p className="mt-3 text-[12px] text-[#16A34A]">{notice}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={scrape} disabled={scraping || saving || loading} className="cursor-pointer rounded-[7px] border border-[var(--qf-border)] px-3.5 py-[7px] text-[13px] font-semibold text-[var(--qf-text)] disabled:cursor-not-allowed disabled:opacity-60">{scraping ? t.scraping : t.scrape}</button>
          <button type="button" onClick={save} disabled={saving || loading || scraping} className="cursor-pointer rounded-[7px] bg-[var(--qf-accent)] px-3.5 py-[7px] text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">{saving ? t.saving : t.saveSettings}</button>
        </div>
      </Card>
    </div>
  );
}

function message(code: string | undefined, t: ReturnType<typeof useForecast>["competitors"], missing?: string[]) {
  if (code === "INVALID_POSITION" || missing?.includes("POSITION")) return t.missingPosition;
  if (code === "TOO_MANY") return t.tagLimit;
  if (code === "LOCATION_NOT_FOUND") return t.locationMissing;
  if (code === "CREDENTIALS_MISSING") return t.credentialsMissing;
  if (code === "CITY_MISSING") return t.cityMissing;
  if (code === "MISSING_FIELDS" && missing?.includes("LOCATION_ID")) return t.missingLocation;
  if (code === "MISSING_FIELDS") return t.missingAccount;
  if (code === "LOCATION_LOOKUP_FAILED") return t.scrapeFailed;
  return t.lookupFailed;
}
