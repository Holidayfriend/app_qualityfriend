"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HousekeepingMessages, Locale } from "../../lib/i18n/dictionaries";
import { extraJobMessages } from "./extra-job-messages";
import { requestMessages } from "../../lib/i18n/dictionaries";
import { BrandLoader } from "../ui/brand-loader";

type Extra = { id: string; description: string; minutes: number };

export function DatabaseExtrasSettings({ t, locale }: { t: HousekeepingMessages; locale: Locale }) {
  return <ExtrasList key={locale} t={t} locale={locale} />;
}

function ExtrasList({ t, locale }: { t: HousekeepingMessages; locale: Locale }) {
  const messages = extraJobMessages[locale];
  const [extras, setExtras] = useState<Extra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/housekeeping/extras?locale=${locale}`, { cache: "no-store" })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<{ extras: Extra[] }>; })
      .then(data => { if (active) setExtras(data.extras); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale]);
  if (loading) return <BrandLoader label={requestMessages[locale].loading} />;
  return <>
    <div className="mb-[10px] flex justify-end"><Link href="/housekeeping/settings/extras/new" className="inline-flex min-h-[34px] items-center rounded-[7px] bg-[var(--qf-accent)] px-[14px] text-[12px] font-semibold text-white">+ {t.addExtra}</Link></div>
    <section className="rounded-[10px] border border-[var(--qf-border)] bg-white px-5 shadow-[var(--qf-shadow)]">
      {error ? <p role="alert" className="py-5 text-sm text-red-700">{messages.loadError}</p> : extras.length === 0 ? <p className="py-5 text-sm">{messages.empty}</p> : extras.map(extra => <article key={extra.id} className="flex min-h-[55px] items-center gap-3 border-b border-[var(--qf-border)] py-[10px] last:border-0">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px] bg-[var(--qf-accent-soft)] text-[15px]">🧹</span>
        <div className="min-w-0 flex-1"><h2 className="break-words text-[13px] font-semibold">{extra.description || messages.untranslated}</h2><p className="mt-0.5 text-[11px] text-[var(--qf-text-light)]">{extra.minutes} {t.minutes}</p></div>
        <Link href={`/housekeeping/settings/extras/new?edit=${extra.id}`} title={t.edit} aria-label={`${t.edit}: ${extra.description || messages.untranslated}`} className="flex h-8 w-8 items-center justify-center rounded-[7px] border border-[var(--qf-border)] text-[13px]">✏️</Link>
      </article>)}
    </section>
  </>;
}
