"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/dashboard/app-shell";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { integrationSettingsMessages } from "../../../lib/i18n/dictionaries";

type Integration = { id: "asa" | "brevo" | "energy" | "access"; icon: string; category: "pms" | "marketing" | "building" | "security"; connected: boolean; aiEnabled: boolean };

const initialIntegrations: Integration[] = [
  { id: "asa", icon: "🏨", category: "pms", connected: true, aiEnabled: true },
  { id: "brevo", icon: "✉️", category: "marketing", connected: false, aiEnabled: false },
  { id: "energy", icon: "🔋", category: "building", connected: false, aiEnabled: false },
  { id: "access", icon: "🔑", category: "security", connected: false, aiEnabled: false },
];

const explanation = {
  en: <>Two separate levels: <strong>Integrations</strong> connect QualityFriend with other software (marketing, energy management, access control). <strong>AI providers</strong> (Claude, Perplexity, DeepSeek — see AI settings) are the language models themselves. Once an integration is connected, AI can also use it as a tool—not only as a data source, similar to MCP connectors: connected → usable, not connected → invisible to AI.</>,
  de: <>Zwei getrennte Ebenen: <strong>Integrationen</strong> verbinden QualityFriend mit anderer Software (Marketing, Energiemanagement, Zutritt). <strong>KI-Anbieter</strong> (Claude, Perplexity, DeepSeek – siehe KI-Einstellungen) sind die Sprachmodelle selbst. Ist eine Integration verbunden, kann die KI sie zusätzlich als Werkzeug nutzen – nicht nur als Datenquelle, ähnlich wie bei MCP-Connectors: verbunden → nutzbar, nicht verbunden → für die KI unsichtbar.</>,
  it: <>Due livelli distinti: le <strong>integrazioni</strong> collegano QualityFriend ad altri software (marketing, gestione energetica, controllo accessi). I <strong>fornitori IA</strong> (Claude, Perplexity, DeepSeek — vedi impostazioni IA) sono invece i modelli linguistici. Quando un’integrazione è collegata, l’IA può usarla anche come strumento e non solo come fonte dati, come con i connettori MCP: collegata → utilizzabile, non collegata → invisibile all’IA.</>,
};

export default function IntegrationsPage() {
  const { locale } = useI18n();
  const router = useRouter();
  const t = integrationSettingsMessages[locale];
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [notice, setNotice] = useState("");
  const connected = integrations.filter((item) => item.connected);
  const available = integrations.filter((item) => !item.connected);

  function connect(id: Integration["id"]) {
    const selected = integrations.find((item) => item.id === id);
    if (!selected) return;
    setIntegrations((items) => items.map((item) => item.id === id ? { ...item, connected: true } : item));
    setNotice(t.connectedNotice.replace("{name}", t.names[selected.id]));
  }

  function toggleAi(id: Integration["id"]) {
    setIntegrations((items) => items.map((item) => item.id === id ? { ...item, aiEnabled: !item.aiEnabled } : item));
  }

  return <AppShell activeItem="settings" pageTitle={t.title}><main className="p-4 sm:p-5 lg:px-7 lg:py-6">
    <button type="button" onClick={() => router.push("/settings")} className="mb-5 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {t.settings}</button>
    <p className="mb-6 text-xs leading-[1.6] text-[var(--qf-text-muted)]">{explanation[locale]}</p>
    {notice ? <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs font-medium text-green-700">{notice}</p> : null}
    <IntegrationSection title={t.connected} empty={t.empty}>{connected.map((item) => <IntegrationCard key={item.id} item={item} t={t} onAction={() => toggleAi(item.id)} />)}</IntegrationSection>
    <IntegrationSection title={t.available}>{available.map((item) => <IntegrationCard key={item.id} item={item} t={t} onAction={() => connect(item.id)} />)}</IntegrationSection>
  </main></AppShell>;
}

type Messages = (typeof integrationSettingsMessages)["en"];

function IntegrationSection({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="mb-7"><h2 className="mb-3 text-[13px] font-bold uppercase tracking-[.6px] text-[var(--qf-text-light)]">{title}</h2><div className="space-y-2.5">{hasChildren ? children : <div className="rounded-lg border border-dashed border-[var(--qf-border)] bg-white p-6 text-center text-xs text-[var(--qf-text-muted)]">{empty}</div>}</div></section>;
}

function IntegrationCard({ item, t, onAction }: { item: Integration; t: Messages; onAction: () => void }) {
  return <article className="flex flex-col gap-3 rounded-lg border border-[var(--qf-border)] bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 flex-1 items-center gap-4"><span className="w-7 shrink-0 text-center text-[25px] leading-none" aria-hidden>{item.icon}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><h3 className="text-[13.5px] font-semibold">{t.names[item.id]}</h3>{item.connected ? <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">{t.connectedStatus}</span> : null}{item.aiEnabled ? <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">✨ {t.aiEnabled}</span> : null}</div><p className="mt-0.5 text-[11.5px] text-[var(--qf-text-light)]">{t.categories[item.category]} · {t.descriptions[item.id]}</p></div></div>
    <button type="button" onClick={onAction} className="min-h-9 shrink-0 cursor-pointer rounded-lg border border-[var(--qf-border)] bg-white px-4 text-xs font-semibold text-[var(--qf-text-muted)] transition hover:border-[var(--qf-accent)] hover:text-[var(--qf-accent)]">{item.connected ? `🤖 ${item.aiEnabled ? t.disableAi : t.enableAi}` : `+ ${t.connect}`}</button>
  </article>;
}
