"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../../components/dashboard/app-shell";
import { BrandLoader } from "../../../../components/ui/brand-loader";
import { useI18n } from "../../../../components/i18n/i18n-provider";
import { aiApiSettingsMessages, requestMessages } from "../../../../lib/i18n/dictionaries";

type UsageModel = { model: string; requests: number; inputTokens: number; outputTokens: number; totalTokens: number };
type UsageProvider = UsageModel & { id: string; name: string; models: UsageModel[] };
type UsagePayload = {
  range: "today" | "week" | "month" | "custom";
  from: string;
  to: string;
  totals: UsageModel;
  providers: UsageProvider[];
};

const ranges = ["today", "week", "month", "custom"] as const;

function todayInput() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function AiUsagePage() {
  const { locale } = useI18n();
  const router = useRouter();
  const t = aiApiSettingsMessages[locale];
  const request = requestMessages[locale];
  const [range, setRange] = useState<(typeof ranges)[number]>("today");
  const [fromDate, setFromDate] = useState(todayInput);
  const [toDate, setToDate] = useState(todayInput);
  const [data, setData] = useState<UsagePayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const number = new Intl.NumberFormat(locale);

  useEffect(() => {
    if (range === "custom" && (!fromDate || !toDate)) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const query = range === "custom"
      ? `range=custom&from=${fromDate}&to=${toDate}`
      : `range=${range}`;
    fetch(`/api/settings/ai-usage?${query}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) return router.replace("/login");
        if (!response.ok) throw new Error();
        setData(await response.json() as UsagePayload);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError(t.usageFailed);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [range, fromDate, toDate, router, t.usageFailed]);

  function chooseCustomDate(which: "from" | "to", value: string) {
    const nextFrom = which === "from" ? value : fromDate;
    const nextTo = which === "to" ? value : toDate;
    if (nextFrom && nextTo && nextFrom > nextTo) {
      setFromDate(nextTo);
      setToDate(nextFrom);
      return;
    }
    if (which === "from") setFromDate(value);
    else setToDate(value);
  }

  const labels = { today: t.usageToday, week: t.usageWeek, month: t.usageMonth, custom: t.usageCustom };

  return (
    <AppShell activeItem="settings" pageTitle={t.usageTitle}>
      <main className="p-4 sm:p-5 lg:px-7 lg:py-6">
        <button type="button" onClick={() => router.push("/settings/ai-keys")} className="mb-5 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {t.title}</button>
        <p className="mb-5 max-w-3xl text-xs leading-[1.6] text-[var(--qf-text-muted)]">{t.usageInfo}</p>
        <div className="mb-5 flex flex-wrap gap-2">
          {ranges.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setRange(item)}
              className={`min-h-10 cursor-pointer rounded-lg px-4 text-xs font-bold ${item === range ? "bg-[var(--qf-accent)] text-white" : "border border-[var(--qf-border)] bg-white text-[var(--qf-text)]"}`}
            >
              {labels[item]}
            </button>
          ))}
        </div>
        {range === "custom" ? (
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold">
              <span className="mb-1.5 block">{t.usageFrom}</span>
              <input type="date" value={fromDate} max={toDate} onChange={(event) => chooseCustomDate("from", event.target.value)} className="h-11 rounded-lg border border-[var(--qf-border)] bg-white px-3 text-sm" />
            </label>
            <label className="text-xs font-semibold">
              <span className="mb-1.5 block">{t.usageTo}</span>
              <input type="date" value={toDate} min={fromDate} onChange={(event) => chooseCustomDate("to", event.target.value)} className="h-11 rounded-lg border border-[var(--qf-border)] bg-white px-3 text-sm" />
            </label>
          </div>
        ) : null}
        {loading ? <BrandLoader label={request.loading} /> : (
          <>
            {error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</p> : null}
            {data ? (
              <section className="overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]">
                <div className="grid grid-cols-2 gap-3 border-b border-[var(--qf-border)] p-5 sm:grid-cols-4">
                  <Total label={t.usageRequests} value={number.format(data.totals.requests)} />
                  <Total label={t.usageInput} value={number.format(data.totals.inputTokens)} />
                  <Total label={t.usageOutput} value={number.format(data.totals.outputTokens)} />
                  <Total label={t.usageTotal} value={number.format(data.totals.totalTokens)} />
                </div>
                <div className="divide-y divide-[var(--qf-border)]">
                  {data.providers.map((provider) => (
                    <article key={provider.id} className="p-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h2 className="text-sm font-bold">{provider.name}</h2>
                        <p className="text-sm font-bold text-[var(--qf-accent)]">{number.format(provider.totalTokens)} {t.usageTokens}</p>
                      </div>
                      <p className="mt-1 text-[11px] text-[var(--qf-text-muted)]">
                        {t.usageRequests} {number.format(provider.requests)} · {t.usageInput} {number.format(provider.inputTokens)} · {t.usageOutput} {number.format(provider.outputTokens)}
                      </p>
                      {provider.models.length ? (
                        <ul className="mt-3 space-y-1">
                          {provider.models.map((model) => (
                            <li key={model.model} className="flex flex-wrap justify-between gap-2 text-[11px] text-[var(--qf-text-muted)]">
                              <span>{model.model}</span>
                              <span>{number.format(model.totalTokens)} {t.usageTokens} · {number.format(model.requests)} {t.usageRequests.toLowerCase()}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-[var(--qf-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
