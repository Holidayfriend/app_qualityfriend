"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/dashboard/app-shell";
import { BrandLoader } from "../../../components/ui/brand-loader";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { aiApiSettingsMessages, requestMessages } from "../../../lib/i18n/dictionaries";

type ProviderCard = {
  id: string;
  name: string;
  implemented: boolean;
  models: string[];
  model: string;
  hasKey: boolean;
  last4: string;
};

export default function AiKeysPage() {
  const { locale } = useI18n();
  const router = useRouter();
  const t = aiApiSettingsMessages[locale];
  const request = requestMessages[locale];
  const [activeProvider, setActiveProvider] = useState("openai");
  const [providers, setProviders] = useState<ProviderCard[]>([]);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);

  function apply(data: { activeProvider: string; providers: ProviderCard[]; canEdit?: boolean }) {
    setActiveProvider(data.activeProvider);
    setProviders(data.providers);
    if (typeof data.canEdit === "boolean") setCanEdit(data.canEdit);
  }

  useEffect(() => {
    fetch("/api/settings/ai-keys")
      .then(async (response) => {
        if (response.status === 401) return router.replace("/login");
        if (!response.ok) throw new Error();
        apply(await response.json());
      })
      .catch(() => setError(t.failed))
      .finally(() => setLoading(false));
  }, [router, t.failed]);

  async function save(provider: ProviderCard, nextActive = activeProvider) {
    setSaving(provider.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/settings/ai-keys", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider.id,
          model: provider.model,
          apiKey: keys[provider.id]?.trim() || undefined,
          activeProvider: nextActive,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error();
      apply(data);
      setKeys((current) => ({ ...current, [provider.id]: "" }));
      setNotice(t.saved);
    } catch {
      setError(t.failed);
    } finally {
      setSaving(null);
    }
  }

  async function chooseActive(id: string) {
    setActiveProvider(id);
    const provider = providers.find((item) => item.id === id);
    if (!canEdit || !provider?.implemented) return;
    await save(provider, id);
  }

  const active = providers.find((item) => item.id === activeProvider);

  return (
    <AppShell activeItem="settings" pageTitle={t.title}>
      <main className="p-4 sm:p-5 lg:px-7 lg:py-6">
        <button type="button" onClick={() => router.push("/settings")} className="mb-5 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {t.settings}</button>
        <p className="mb-6 max-w-3xl text-xs leading-[1.6] text-[var(--qf-text-muted)]">{t.info}</p>
        {loading ? <BrandLoader label={request.loading} /> : (
          <>
            {error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</p> : null}
            {notice ? <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs font-medium text-green-700">{notice}</p> : null}
            {!canEdit ? <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">{t.viewOnly}</p> : null}
            <section className="mb-6 overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white p-5 shadow-[var(--qf-shadow)] sm:p-6">
              <h2 className="text-[15px] font-bold">{t.activeProvider}</h2>
              <p className="mt-1 text-xs text-[var(--qf-text-muted)]">{t.activeHelp}</p>
              {active ? <p className="mt-2 text-xs font-semibold text-[var(--qf-accent)]">{t.usingNow.replace("{provider}", active.name).replace("{model}", active.model)}</p> : null}
              <select
                value={activeProvider}
                disabled={!canEdit || saving !== null}
                onChange={(event) => void chooseActive(event.target.value)}
                className="qf-field mt-3 max-w-sm"
              >
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id} disabled={!provider.implemented}>
                    {provider.name}{provider.implemented ? "" : ` (${t.comingSoon})`}
                  </option>
                ))}
              </select>
            </section>
            <div className="grid gap-3 lg:grid-cols-2">
              {providers.map((provider) => (
                <article key={provider.id} className={`rounded-[var(--qf-radius)] border bg-white p-4 shadow-[var(--qf-shadow)] sm:p-5 ${provider.id === activeProvider ? "border-[var(--qf-accent)]" : "border-[var(--qf-border)]"}`}>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold">{provider.name}</h3>
                      <p className="mt-1 text-[11px] text-[var(--qf-text-muted)]">{provider.implemented ? t.ready : t.comingSoonHelp}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${provider.hasKey ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                      {provider.hasKey ? `${t.configured} ••••${provider.last4}` : t.notSet}
                    </span>
                  </div>
                  <label className="mb-3 block text-xs font-semibold">
                    <span className="mb-1.5 block">{t.model}</span>
                    <select
                      value={provider.model}
                      disabled={!canEdit || saving !== null}
                      onChange={(event) => {
                        const model = event.target.value;
                        const next = { ...provider, model };
                        setProviders((current) => current.map((item) => item.id === provider.id ? next : item));
                        if (canEdit) void save(next, activeProvider);
                      }}
                      className="h-11 w-full rounded-lg border border-[var(--qf-border)] bg-white px-3 text-sm"
                    >
                      {provider.models.map((model) => <option key={model} value={model}>{model}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold">
                    <span className="mb-1.5 block">{provider.hasKey ? t.replaceKey : t.apiKey}</span>
                    <input
                      type="password"
                      autoComplete="off"
                      value={keys[provider.id] || ""}
                      disabled={!canEdit}
                      onChange={(event) => setKeys((current) => ({ ...current, [provider.id]: event.target.value }))}
                      placeholder={t.apiKeyPlaceholder}
                      className="h-11 w-full rounded-lg border border-[var(--qf-border)] px-3.5 text-sm outline-none focus:border-[var(--qf-accent)]"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!canEdit || saving !== null || (!provider.implemented && !keys[provider.id]?.trim() && !provider.model)}
                    onClick={() => void save(provider)}
                    className="mt-3 min-h-10 w-full cursor-pointer rounded-lg bg-[var(--qf-accent)] px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {saving === provider.id ? t.saving : t.save}
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
