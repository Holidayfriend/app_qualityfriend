"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/dashboard/app-shell";
import { BrandLoader } from "../../../components/ui/brand-loader";
import { useI18n } from "../../../components/i18n/i18n-provider";

type Status = { active: boolean; hotelId: string | null; userEmail: string | null; departmentId: string | null };
const copy = {
  en: { title: "MCP integrations", settings: "Settings", info: "MCP connects QualityFriend securely with external services and gives the AI access to approved tools and hotel data. Once connected, available MCP services can be configured and used throughout QualityFriend.", heading: "QualityFriend MCP", description: "Connect your hotel to the QualityFriend MCP service. This creates a secure hotel workspace and service user for AI integrations.", online: "Online", offline: "Not connected", connect: "Connect with MCP", connecting: "Connecting…", connected: "MCP is active and ready to use.", failed: "MCP could not be connected. Please try again.", account: "Service account" },
  de: { title: "MCP-Integrationen", settings: "Einstellungen", info: "MCP verbindet QualityFriend sicher mit externen Diensten und ermöglicht der KI den Zugriff auf freigegebene Werkzeuge und Hoteldaten. Nach der Verbindung können verfügbare MCP-Dienste in QualityFriend konfiguriert und verwendet werden.", heading: "QualityFriend MCP", description: "Verbinden Sie Ihr Hotel mit dem QualityFriend-MCP-Dienst. Dabei werden ein sicherer Hotel-Arbeitsbereich und ein Dienstbenutzer für KI-Integrationen erstellt.", online: "Online", offline: "Nicht verbunden", connect: "Mit MCP verbinden", connecting: "Verbindung wird hergestellt…", connected: "MCP ist aktiv und einsatzbereit.", failed: "MCP konnte nicht verbunden werden. Bitte versuchen Sie es erneut.", account: "Dienstkonto" },
  it: { title: "Integrazioni MCP", settings: "Impostazioni", info: "MCP collega QualityFriend in modo sicuro ai servizi esterni e consente all'IA di accedere agli strumenti approvati e ai dati dell'hotel. Dopo la connessione, i servizi MCP disponibili possono essere configurati e utilizzati in QualityFriend.", heading: "QualityFriend MCP", description: "Collega il tuo hotel al servizio MCP di QualityFriend. Verranno creati uno spazio hotel sicuro e un utente di servizio per le integrazioni IA.", online: "Online", offline: "Non connesso", connect: "Connetti con MCP", connecting: "Connessione…", connected: "MCP è attivo e pronto all'uso.", failed: "Impossibile connettere MCP. Riprova.", account: "Account di servizio" },
} as const;

export default function McpSettingsPage() {
  const { locale } = useI18n(); const router = useRouter(); const t = copy[locale];
  const [status, setStatus] = useState<Status | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { fetch("/api/settings/mcp").then(async (response) => { if (response.status === 401) return router.replace("/login"); if (!response.ok) throw new Error(); setStatus(await response.json()); }).catch(() => setError(t.failed)); }, [router, t.failed]);
  async function connect() {
    setBusy(true); setError("");
    try { const response = await fetch("/api/settings/mcp", { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : t.failed); setStatus(data); }
    catch (caught) { setError(caught instanceof Error ? caught.message : t.failed); }
    finally { setBusy(false); }
  }
  return <AppShell activeItem="settings" pageTitle={t.title}><main className="p-4 sm:p-5 lg:px-7 lg:py-6">
    <button type="button" onClick={() => router.push("/settings")} className="mb-5 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {t.settings}</button>
    <p className="mb-6 text-xs leading-[1.6] text-[var(--qf-text-muted)]">{t.info}</p>
    {!status && !error ? <BrandLoader label={t.connecting} /> : <section className="w-full overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]">
      <div className="flex flex-col gap-5 border-b border-[var(--qf-border)] p-5 sm:flex-row sm:items-start sm:justify-between sm:p-7">
        <div className="flex gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--qf-accent-soft)] text-2xl" aria-hidden>🔌</span><div><h1 className="text-lg font-bold">{t.heading}</h1><p className="mt-1 max-w-xl text-[13px] leading-6 text-[var(--qf-text-muted)]">{t.description}</p></div></div>
        <span className={`inline-flex w-fit shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold ${status?.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}><span className={`h-2 w-2 shrink-0 rounded-full ${status?.active ? "bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,.15)]" : "bg-slate-400"}`} />{status?.active ? t.online : t.offline}</span>
      </div>
      <div className="p-5 sm:p-7">{error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</p> : null}{status?.active ? <div><p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">✓ {t.connected}</p>{status.userEmail ? <p className="mt-4 break-all text-xs text-[var(--qf-text-muted)]"><span className="font-semibold text-[var(--qf-text)]">{t.account}:</span> {status.userEmail}</p> : null}</div> : <button type="button" disabled={busy} onClick={connect} className="min-h-11 w-full cursor-pointer rounded-lg bg-[var(--qf-accent)] px-5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60 sm:w-auto">{busy ? t.connecting : t.connect}</button>}</div>
    </section>}
  </main></AppShell>;
}
