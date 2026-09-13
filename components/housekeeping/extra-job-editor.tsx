"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { housekeepingMessages, requestMessages, type Locale } from "../../lib/i18n/dictionaries";
import { BrandLoader } from "../ui/brand-loader";
import { extraJobMessages } from "./extra-job-messages";

export function ExtraJobEditor() {
  const { locale } = useI18n();
  const id = useSearchParams().get("edit");
  return <Editor key={`${id}:${locale}`} id={id} locale={locale} />;
}

function Editor({ id, locale }: { id: string | null; locale: Locale }) {
  const t = housekeepingMessages[locale];
  const messages = extraJobMessages[locale];
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [loading, setLoading] = useState(Boolean(id));
  const [loaded, setLoaded] = useState(!id);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetch(`/api/housekeeping/extras/${id}?locale=${locale}`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error(messages.loadError);
        return response.json() as Promise<{ extra: { description: string; minutes: number } }>;
      })
      .then(({ extra }) => { if (active) { setDescription(extra.description); setMinutes(String(extra.minutes)); setLoaded(true); } })
      .catch(() => { if (active) setError(messages.loadError); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, locale, messages.loadError]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !loaded) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(id ? `/api/housekeeping/extras/${id}` : "/api/housekeeping/extras", {
        method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, description, minutes: Number(minutes) }),
      });
      if (!response.ok) throw new Error(messages.saveError);
      router.push("/housekeeping/settings/extras"); router.refresh();
    } catch { setError(messages.saveError); setSaving(false); }
  }

  const button = "inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-[7px] border px-3 text-[12px] font-semibold transition hover:border-[var(--qf-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--qf-accent)]";
  return <AppShell activeItem="housekeeping" pageTitle={t.housekeeping}><main className="qf-housekeeping w-full p-4 pb-24 sm:p-5 lg:px-7 lg:py-6">
    <Link href="/housekeeping/settings/extras" className="mb-4 inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--qf-accent)] hover:underline"><span aria-hidden>←</span>{t.back}</Link>
    {loading ? <BrandLoader label={requestMessages[locale].loading} /> : <section className="overflow-hidden rounded-[10px] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)] max-w-2xl">
      <header className="flex min-h-[51px] items-center justify-between gap-3 border-b border-[var(--qf-border)] px-5 py-[14px]"><h2 className="text-[14px] font-bold">{t.extraJobs}</h2></header>
      <form className="space-y-4 p-4" onSubmit={save}>
          <label className="block text-[11.5px] font-semibold"><span className="mb-1.5 block">{t.label}</span><input className="qf-field" placeholder="Clean sauna" disabled={saving || !loaded} value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} required /></label>
          <label className="block text-[11.5px] font-semibold"><span className="mb-1.5 block">{t.time}</span><input className="qf-field" type="number" disabled={saving || !loaded} min={0} max={2147483647} step={1} value={minutes} onChange={event => setMinutes(event.target.value)} required /></label>
        {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
        <div className="flex gap-2 border-t border-[var(--qf-border)] pt-4"><button disabled={saving || !loaded} className={`${button} border-[var(--qf-accent)] bg-[var(--qf-accent)] text-white`}>{t.save}</button><Link href="/housekeeping/settings" className={`${button} border-[var(--qf-border)] bg-white`}>{t.cancel}</Link></div>
      </form>
    </section>}
  </main>{saving ? <BrandLoader label={requestMessages[locale].loading} overlay /> : null}</AppShell>;
}
