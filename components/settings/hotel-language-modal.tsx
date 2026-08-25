"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BrandLoader } from "../ui/brand-loader";
import { Button } from "../ui/button";
import { useI18n } from "../i18n/i18n-provider";
import { hotelLanguageMessages, requestMessages } from "../../lib/i18n/dictionaries";

type Language = "EN" | "DE" | "IT";

export function HotelLanguageModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale } = useI18n();
  const labels = hotelLanguageMessages[locale];
  const request = requestMessages[locale];
  const [language, setLanguage] = useState<Language>("EN");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/settings/hotel-language")
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (active) setLanguage(data.language);
      })
      .catch(() => { if (active) setError(request.failed); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, request.failed]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/settings/hotel-language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language }),
      });
      if (!response.ok) throw new Error();
      onClose();
    } catch { setError(request.failed); }
    finally { setLoading(false); }
  }

  if (!open) return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div role="dialog" aria-modal="true" className="w-full max-w-[420px] overflow-hidden rounded-xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-[var(--qf-border)] px-5 py-4"><h2 className="text-[15px] font-bold">{labels.title}</h2><button type="button" onClick={onClose} className="h-7 w-7 cursor-pointer rounded-md hover:bg-[var(--qf-background)]">×</button></header>
      <form onSubmit={save}><div className="px-5 py-5">{error ? <p role="alert" className="mb-3 text-xs text-red-600">{error}</p> : null}<label className="text-xs font-semibold"><span className="mb-1.5 block">{labels.label}</span><select value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="h-10 w-full cursor-pointer rounded-md border border-[var(--qf-border)] bg-white px-3 text-sm outline-none focus:border-[var(--qf-accent)]"><option value="EN">English</option><option value="DE">Deutsch</option><option value="IT">Italiano</option></select></label></div><footer className="flex justify-end gap-2.5 border-t border-[var(--qf-border)] px-5 py-4"><Button type="button" variant="secondary" onClick={onClose}>{labels.cancel}</Button><Button type="submit">{labels.save}</Button></footer></form>
    </div>
    {loading ? <BrandLoader label={request.loading} overlay /> : null}
  </div>;
}
