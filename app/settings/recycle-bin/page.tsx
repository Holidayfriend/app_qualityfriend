"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/dashboard/app-shell";
import { BrandLoader } from "../../../components/ui/brand-loader";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { recycleBinMessages, requestMessages } from "../../../lib/i18n/dictionaries";

type Item = { id: string; type: "department" | "team" | "user"; names: Record<"en" | "de" | "it", string>; deletedAt: string };

export default function RecycleBinPage() {
  const { dictionary, locale } = useI18n();
  const router = useRouter();
  const labels = recycleBinMessages[locale];
  const request = requestMessages[locale];
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/settings/recycle-bin");
        if (response.status === 401) return router.replace("/login");
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (active) setItems(data);
      } catch { if (active) setError(request.failed); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [request.failed, router]);

  async function restore(item: Item) {
    setRestoring(true); setError("");
    try {
      const response = await fetch(`/api/settings/recycle-bin/${item.type}/${item.id}`, { method: "PATCH" });
      if (response.status === 401) return router.replace("/login");
      if (!response.ok) throw new Error();
      setItems((current) => current.filter((entry) => entry.id !== item.id || entry.type !== item.type));
    } catch { setError(request.failed); }
    finally { setRestoring(false); }
  }

  return <AppShell activeItem="settings"><main className="p-4 sm:p-5 lg:p-7">
    <button type="button" onClick={() => router.push("/settings")} className="mb-3.5 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {dictionary.settings.recycleBin}</button>
    {loading ? <BrandLoader label={request.loading} /> : <section className="overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]"><header className="border-b border-[var(--qf-border)] px-5 py-4"><h1 className="text-sm font-bold">{dictionary.settings.recycleBin}</h1><p className="mt-1 text-xs text-[var(--qf-text-muted)]">{labels.description}</p></header>{error ? <p role="alert" className="m-5 rounded-md bg-red-50 p-3 text-xs text-red-700">{error}</p> : null}{items.length === 0 ? <p className="p-8 text-center text-sm text-[var(--qf-text-muted)]">{labels.empty}</p> : <div className="divide-y divide-[var(--qf-border)]">{items.map((item) => <article key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5"><div><p className="text-[13px] font-semibold">{item.names[locale]}</p><p className="mt-0.5 text-[11px] text-[var(--qf-text-muted)]">{labels.types[item.type]} · {labels.deleted} {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.deletedAt))}</p></div><button type="button" onClick={() => void restore(item)} aria-label={`${labels.restore}: ${item.names[locale]}`} title={labels.restore} className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-[var(--qf-border)] bg-white text-lg text-[var(--qf-text-muted)] transition hover:border-[var(--qf-accent)] hover:bg-[var(--qf-accent-soft)] hover:text-[var(--qf-accent)]">↻</button></article>)}</div>}</section>}
    {restoring ? <BrandLoader label={request.loading} overlay /> : null}
  </main></AppShell>;
}
