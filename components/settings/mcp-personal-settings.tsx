"use client";

import { useEffect, useState, type FormEvent } from "react";
import { mcpPortalMessages } from "../../lib/i18n/dictionaries";
import { useI18n } from "../i18n/i18n-provider";
import { BrandLoader } from "../ui/brand-loader";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast-provider";

const modelOptions = {
  openai: ["gpt-5", "gpt-5-mini", "gpt-5-nano", "gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
  deepseek: ["deepseek-chat", "deepseek-coder"],
  perplexity: ["sonar", "sonar-reasoning-pro", "sonar-deep-research"],
  claude: ["claude-sonnet-4-5", "claude-haiku-4-5", "claude-opus-4-5", "claude-opus-4-1"],
} as const;

const providers = Object.keys(modelOptions) as Provider[];
const providerNames: Record<Provider, string> = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  perplexity: "Perplexity",
  claude: "Claude",
};

type Provider = keyof typeof modelOptions;
type Account = { hotel: string; role: string; department: string; email: string };
type Preferences = {
  enabledProviders: Provider[];
  defaultProvider: Provider | null;
  models: Record<Provider, string>;
};

const blankPreferences: Preferences = {
  enabledProviders: [],
  defaultProvider: null,
  models: {
    openai: modelOptions.openai[0],
    deepseek: modelOptions.deepseek[0],
    perplexity: modelOptions.perplexity[0],
    claude: modelOptions.claude[0],
  },
};

function fieldClass() {
  return "h-11 w-full rounded-lg border border-[var(--qf-border)] bg-[#f8f7f4] px-3.5 text-sm text-[var(--qf-text-muted)] outline-none disabled:cursor-not-allowed";
}

export function McpPersonalSettings() {
  const { locale } = useI18n();
  const text = mcpPortalMessages[locale];
  const toast = useToast();
  const [section, setSection] = useState<"account" | "preferences">("account");
  const [account, setAccount] = useState<Account | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(blankPreferences);
  const [savedPreferences, setSavedPreferences] = useState<Preferences>(blankPreferences);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<"preferences" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/settings/mcp-portal/personal-settings", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "LOAD_FAILED");
        const next = data.preferences as Preferences;
        setAccount(data.account as Account);
        setPreferences(next);
        setSavedPreferences(next);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setLoadError(error instanceof Error ? error.message : "LOAD_FAILED");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  function errorMessage(code: string) {
    if (code === "MCP_NOT_ACTIVE" || code === "MCP_USER_NOT_SYNCED") return text.mcpNotReady;
    if (code === "PROVIDER_REQUIRED") return text.providerRequired;
    if (code === "DEFAULT_PROVIDER_NOT_ENABLED") return text.defaultProviderNotEnabled;
    return text.saveFailed;
  }

  function toggleProvider(provider: Provider) {
    setPreferences((current) => {
      const enabled = current.enabledProviders.includes(provider);
      const enabledProviders = enabled
        ? current.enabledProviders.filter((item) => item !== provider)
        : [...current.enabledProviders, provider];
      return {
        ...current,
        enabledProviders,
        defaultProvider: enabled && current.defaultProvider === provider ? null : current.defaultProvider,
      };
    });
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preferences.enabledProviders.length) {
      toast({ message: text.providerRequired, tone: "error" });
      return;
    }
    if (preferences.defaultProvider && !preferences.enabledProviders.includes(preferences.defaultProvider)) {
      toast({ message: text.defaultProviderNotEnabled, tone: "error" });
      return;
    }
    setBusy("preferences");
    try {
      const response = await fetch("/api/settings/mcp-portal/personal-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preferences", ...preferences }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast({ message: errorMessage(typeof data.error === "string" ? data.error : ""), tone: "error" });
        return;
      }
      const saved = data.preferences as Preferences;
      setPreferences(saved);
      setSavedPreferences(saved);
      toast({ message: text.preferencesSaved, tone: "success" });
    } catch {
      toast({ message: text.saveFailed, tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <BrandLoader label={text.loading} />;
  if (loadError || !account) {
    return (
      <section className="rounded-[var(--qf-radius)] border border-red-200 bg-white p-6 shadow-[var(--qf-shadow)]">
        <p role="alert" className="text-sm font-semibold text-red-700">
          {loadError === "MCP_NOT_ACTIVE" || loadError === "MCP_USER_NOT_SYNCED" ? text.mcpNotReady : text.loadFailed}
        </p>
        <Button className="mt-4" variant="secondary" onClick={() => { setLoading(true); setLoadError(""); setReloadKey((value) => value + 1); }}>{text.retry}</Button>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]">
      <div className="flex border-b border-[var(--qf-border)] bg-[#faf9f7] px-4 pt-3 sm:px-6">
        {(["account", "preferences"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setSection(item)}
            className={`cursor-pointer border-b-2 px-4 py-3 text-[13px] font-bold transition ${section === item ? "border-[var(--qf-accent)] text-[var(--qf-accent)]" : "border-transparent text-[var(--qf-text-muted)] hover:text-[var(--qf-text)]"}`}
          >
            {item === "account" ? text.accountDetails : text.preferences}
          </button>
        ))}
      </div>

      {section === "account" ? (
        <div className="p-5 sm:p-7">
          <div className="mb-6">
            <h2 className="text-base font-bold text-[var(--qf-text)]">{text.accountDetails}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--qf-text-muted)]">{text.accountHelp}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {([
              [text.hotel, account.hotel],
              [text.role, account.role],
              [text.department, account.department],
              [text.email, account.email],
            ] as const).map(([label, value]) => (
              <label key={label} className="block text-[13px] font-semibold text-[var(--qf-text)]">
                <span className="mb-1.5 block">{label}</span>
                <input disabled value={value || text.notAvailable} className={fieldClass()} />
              </label>
            ))}
          </div>
        </div>
      ) : (
        <form className="p-5 sm:p-7" onSubmit={(event) => void savePreferences(event)}>
          <div className="mb-6">
            <h2 className="text-base font-bold text-[var(--qf-text)]">{text.preferences}</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--qf-text-muted)]">{text.preferencesHelp}</p>
          </div>

          <label className="block max-w-md text-[13px] font-semibold text-[var(--qf-text)]">
            <span className="mb-1.5 block">{text.defaultProvider}</span>
            <select
              value={preferences.defaultProvider ?? ""}
              onChange={(event) => setPreferences((current) => ({ ...current, defaultProvider: (event.target.value || null) as Provider | null }))}
              className="h-11 w-full rounded-lg border border-[var(--qf-border)] bg-white px-3.5 text-sm outline-none focus:border-[var(--qf-accent)]"
            >
              <option value="">{text.selectDefault}</option>
              {providers.map((provider) => <option key={provider} value={provider} disabled={!preferences.enabledProviders.includes(provider)}>{providerNames[provider]}</option>)}
            </select>
          </label>

          <fieldset className="mt-6">
            <legend className="mb-3 text-[13px] font-semibold text-[var(--qf-text)]">{text.enabledProviders}</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {providers.map((provider) => {
                const enabled = preferences.enabledProviders.includes(provider);
                return (
                  <label key={provider} className={`flex cursor-pointer items-center justify-between rounded-lg border p-4 transition ${enabled ? "border-[var(--qf-accent)] bg-[var(--qf-accent-soft)]" : "border-[var(--qf-border)] bg-white hover:border-[var(--qf-accent)]"}`}>
                    <span className="text-sm font-bold">{providerNames[provider]}</span>
                    <input type="checkbox" checked={enabled} onChange={() => toggleProvider(provider)} className="h-4 w-4 accent-[var(--qf-accent)]" />
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-7 border-t border-[var(--qf-border)] pt-6">
            <legend className="px-1 text-[13px] font-semibold text-[var(--qf-text)]">{text.models}</legend>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {providers.map((provider) => {
                const enabled = preferences.enabledProviders.includes(provider);
                return (
                  <label key={provider} className={`block rounded-lg border p-4 ${enabled ? "border-[var(--qf-border)] bg-white" : "border-[var(--qf-border)] bg-[#faf9f7] opacity-60"}`}>
                    <span className="mb-2 block text-[13px] font-bold">{providerNames[provider]}</span>
                    <select
                      disabled={!enabled}
                      value={preferences.models[provider]}
                      onChange={(event) => setPreferences((current) => ({ ...current, models: { ...current.models, [provider]: event.target.value } }))}
                      className="h-11 w-full rounded-lg border border-[var(--qf-border)] bg-white px-3.5 text-sm outline-none focus:border-[var(--qf-accent)] disabled:cursor-not-allowed"
                    >
                      {modelOptions[provider].map((model) => <option key={model} value={model}>{model}</option>)}
                    </select>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--qf-border)] pt-5">
            <Button type="submit" disabled={busy !== null}>{text.saveChanges}</Button>
            <Button type="button" variant="secondary" disabled={busy !== null} onClick={() => setPreferences(savedPreferences)}>{text.cancel}</Button>
          </div>
        </form>
      )}
    </section>
  );
}
