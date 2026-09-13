"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HousekeepingMessages, Locale } from "../../lib/i18n/dictionaries";

import { BrandLoader } from "../ui/brand-loader";
import { requestMessages } from "../../lib/i18n/dictionaries";

type Category = {
  id: string;
  name: string;
  express: number | null;
  normal: number | null;
  departure: number | null;
  final: number | null;
};

export function DatabaseCategoriesSettings({ t, locale }: { t: HousekeepingMessages; locale: Locale }) {
  const [loadedLocale, setLoadedLocale] = useState<Locale | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let active = true;

    fetch(`/api/housekeeping/categories?locale=${locale}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load room categories.");
        return response.json() as Promise<{ categories: Category[] }>;
      })
      .then((data) => { if (active) setCategories(data.categories); })
      .catch(() => { if (active) setCategories([]); })
      .finally(() => { if (active) setLoadedLocale(locale); });

    return () => { active = false; };
  }, [locale]);

  if (loadedLocale !== locale) return <BrandLoader label={requestMessages[locale].loading} />;

  return <>
    <div className="mb-[10px] flex justify-end"><Link href="/housekeeping/settings/categories/new" className="inline-flex min-h-[34px] items-center rounded-[7px] bg-[var(--qf-accent)] px-[14px] text-[12px] font-semibold text-white">+ {t.addCategory}</Link></div>
    <section className="rounded-[10px] border border-[var(--qf-border)] bg-white px-5 shadow-[var(--qf-shadow)]">
      {categories.map((category) => <article key={category.id} className="flex min-h-[55px] items-center gap-3 border-b border-[var(--qf-border)] py-[10px] last:border-0">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px] bg-[var(--qf-accent-soft)] text-[15px]">🛏️</span>
        <div className="min-w-0 flex-1"><h2 className="text-[13px] font-semibold">{category.name}</h2><p className="mt-0.5 text-[11px] text-[var(--qf-text-light)]">Express {category.express ?? "—"} {t.minutes} · Normal {category.normal ?? "—"} {t.minutes} · {t.departures} {category.departure ?? "—"} {t.minutes} · End {category.final ?? "—"} {t.minutes}</p></div>
        <Link href={`/housekeeping/settings/categories/new?edit=${category.id}`} title={t.edit} aria-label={`${t.edit}: ${category.name}`} className="flex h-8 w-8 items-center justify-center rounded-[7px] border border-[var(--qf-border)] text-[13px]">✏️</Link>
      </article>)}
    </section>
  </>;
}
