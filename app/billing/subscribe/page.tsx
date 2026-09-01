"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "../../../components/auth/auth-shell";
import { AuthCard } from "../../../components/auth/auth-card";
import { Button } from "../../../components/ui/button";
import { useI18n } from "../../../components/i18n/i18n-provider";

type BillingData = { status: string; subscriptionId: string | null; nextBillingAt: string | null; canManage: boolean; clientId: string | null; environment: string; price: string; currency: string };
type PaypalNamespace = { Buttons: (options: Record<string, unknown>) => { render: (element: HTMLElement) => Promise<void>; close?: () => void } };

const copy = {
  en: { eyebrow: "QualityFriend subscription", title: "Activate your hotel", description: "One simple plan gives your hotel team full access.", plan: "QualityFriend Monthly", price: "€39", month: "/ month", includes: "Full access for all active users in your hotel", pending: "PayPal is confirming your subscription. This page updates automatically.", active: "Your subscription is active.", suspended: "Your subscription is not active. Complete or renew payment to continue.", dashboard: "Continue to dashboard", cancel: "Cancel subscription", cancelling: "Cancelling…", error: "PayPal could not be loaded. Check the configuration and try again.", admin: "Only the hotel administrator can manage the subscription.", signout: "Sign out" },
  de: { eyebrow: "QualityFriend-Abonnement", title: "Hotel aktivieren", description: "Ein einfacher Tarif bietet Ihrem Hotelteam vollen Zugriff.", plan: "QualityFriend Monatlich", price: "39 €", month: "/ Monat", includes: "Voller Zugriff für alle aktiven Benutzer Ihres Hotels", pending: "PayPal bestätigt Ihr Abonnement. Diese Seite wird automatisch aktualisiert.", active: "Ihr Abonnement ist aktiv.", suspended: "Ihr Abonnement ist nicht aktiv. Schließen Sie die Zahlung ab, um fortzufahren.", dashboard: "Zum Dashboard", cancel: "Abonnement kündigen", cancelling: "Wird gekündigt…", error: "PayPal konnte nicht geladen werden. Prüfen Sie die Konfiguration.", admin: "Nur der Hoteladministrator kann das Abonnement verwalten.", signout: "Abmelden" },
  it: { eyebrow: "Abbonamento QualityFriend", title: "Attiva il tuo hotel", description: "Un unico piano offre accesso completo al team del tuo hotel.", plan: "QualityFriend Mensile", price: "39 €", month: "/ mese", includes: "Accesso completo per tutti gli utenti attivi dell'hotel", pending: "PayPal sta confermando l'abbonamento. Questa pagina si aggiorna automaticamente.", active: "Il tuo abbonamento è attivo.", suspended: "L'abbonamento non è attivo. Completa il pagamento per continuare.", dashboard: "Vai alla dashboard", cancel: "Annulla abbonamento", cancelling: "Annullamento…", error: "Impossibile caricare PayPal. Controlla la configurazione.", admin: "Solo l'amministratore dell'hotel può gestire l'abbonamento.", signout: "Esci" },
};

export default function SubscribePage() {
  const { locale, dictionary } = useI18n();
  const t = copy[locale];
  const router = useRouter();
  const paypalContainer = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<BillingData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch("/api/billing/subscription", { cache: "no-store" });
      if (response.status === 401) { router.replace("/login"); return; }
      const value = await response.json();
      if (active) setData(value);
    }
    void load();
    const timer = window.setInterval(() => { if (data?.status === "APPROVAL_PENDING") void load(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [router, data?.status]);

  useEffect(() => {
    if (!data?.clientId || !data.canManage || data.status === "ACTIVE" || !paypalContainer.current) return;
    const clientId = data.clientId;
    let cancelled = false;
    let buttons: { close?: () => void } | undefined;
    async function mount() {
      try {
        let paypal = (window as unknown as { paypal?: PaypalNamespace }).paypal;
        if (!paypal) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>('script[data-qualityfriend-paypal="true"]');
            if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(), { once: true }); return; }
            const script = document.createElement("script");
            script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription&currency=EUR`;
            script.dataset.qualityfriendPaypal = "true";
            script.onload = () => resolve(); script.onerror = () => reject(); document.head.appendChild(script);
          });
          paypal = (window as unknown as { paypal?: PaypalNamespace }).paypal;
        }
        if (!paypal || cancelled || !paypalContainer.current) return;
        paypalContainer.current.innerHTML = "";
        buttons = paypal.Buttons({
          style: { shape: "rect", color: "gold", layout: "vertical", label: "subscribe" },
          createSubscription: async () => {
            setError("");
            const response = await fetch("/api/billing/paypal/create-subscription", { method: "POST" });
            const result = await response.json();
            if (!response.ok || !result.subscriptionId) throw new Error(result.error || "CREATE_FAILED");
            return result.subscriptionId;
          },
          onApprove: async (details: { subscriptionID?: string }) => {
            const response = await fetch("/api/billing/paypal/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscriptionId: details.subscriptionID }) });
            if (!response.ok) { setError(t.error); return; }
            const result = await response.json();
            setData((current) => current ? { ...current, status: result.status || "APPROVAL_PENDING", subscriptionId: details.subscriptionID || null } : current);
          },
          onError: () => setError(t.error),
          onCancel: () => setError(""),
        });
        await (buttons as ReturnType<PaypalNamespace["Buttons"]>).render(paypalContainer.current);
      } catch { if (!cancelled) setError(t.error); }
    }
    void mount();
    return () => { cancelled = true; buttons?.close?.(); };
  }, [data?.clientId, data?.canManage, data?.status, t.error]);

  async function cancel() {
    if (!window.confirm(t.cancel)) return;
    setBusy(true); setError("");
    const response = await fetch("/api/billing/paypal/cancel", { method: "POST" }).catch(() => null);
    if (!response?.ok) setError(t.error);
    setBusy(false);
  }

  async function logout() { await fetch("/api/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }

  return <AuthShell eyebrow={t.eyebrow} title={t.title} description={t.description} brandSubtitle={dictionary.common.brandSubtitle}>
    <AuthCard title={t.plan} subtitle={t.includes}>
      <div className="text-center"><span className="text-4xl font-bold text-[var(--qf-text)]">{data ? new Intl.NumberFormat(locale, { style: "currency", currency: data.currency }).format(Number(data.price)) : t.price}</span><span className="ml-1 text-sm text-[var(--qf-text-muted)]">{t.month}</span></div>
      {!data ? <div className="mt-6 h-12 animate-pulse rounded-lg bg-[var(--qf-border)]" /> : null}
      {data?.status === "ACTIVE" ? <div className="mt-6 space-y-4"><p className="rounded-lg bg-green-50 p-4 text-sm font-semibold text-green-700">✓ {t.active}</p><Button fullWidth onClick={() => router.push("/dashboard")}>{t.dashboard}</Button>{data.canManage ? <button onClick={cancel} disabled={busy} className="w-full cursor-pointer text-sm font-semibold text-red-600 disabled:opacity-50">{busy ? t.cancelling : t.cancel}</button> : null}</div> : null}
      {data && data.status !== "ACTIVE" ? <div className="mt-6 space-y-4"><p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">{data.status === "APPROVAL_PENDING" ? t.pending : t.suspended}</p>{data.canManage ? <div ref={paypalContainer} className="min-h-12" /> : <p className="text-sm text-[var(--qf-text-muted)]">{t.admin}</p>}</div> : null}
      {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <button onClick={logout} className="mt-6 w-full cursor-pointer text-sm text-[var(--qf-text-muted)] hover:underline">{t.signout}</button>
    </AuthCard>
  </AuthShell>;
}
