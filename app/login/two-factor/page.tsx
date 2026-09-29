"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthShell } from "../../../components/auth/auth-shell";
import { AuthCard } from "../../../components/auth/auth-card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { useI18n } from "../../../components/i18n/i18n-provider";

export default function TwoFactorLoginPage() {
  const { dictionary, setLocale } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!code || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/login/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (result?.error === "CHALLENGE_EXPIRED") setError("Your login verification expired. Return to login and try again.");
        else if (result?.error === "TWO_FACTOR_RESET_REQUIRED") setError("Your authenticator encryption key changed. Use a recovery code or contact an administrator to reset two-factor authentication.");
        else setError("The verification or recovery code is invalid.");
        return;
      }
      if (result?.language === "en" || result?.language === "de" || result?.language === "it") setLocale(result.language);
      router.replace(result?.redirectTo || "/dashboard");
      router.refresh();
    } catch {
      setError("Verification could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function emailRecovery(action: "send" | "verify") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/login/two-factor/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, code: emailCode }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (result?.error === "CHALLENGE_EXPIRED") setError("Your login verification expired. Return to login and try again.");
        else if (result?.error === "CODE_EXPIRED") setError("The email code expired. Request a new code.");
        else if (result?.error === "INVALID_CODE") setError("The email verification code is invalid.");
        else setError("The recovery email could not be sent. Please try again.");
        return;
      }
      if (action === "send") {
        setRecoveryEmail(result?.maskedEmail || "your account email");
        return;
      }
      if (result?.language === "en" || result?.language === "de" || result?.language === "it") setLocale(result.language);
      router.replace(result?.redirectTo || "/settings/two-factor");
      router.refresh();
    } catch {
      setError("Recovery could not be completed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <AuthShell eyebrow="Security check" title="Two-factor authentication" description="Enter the code from your authenticator app to continue." brandSubtitle={dictionary.common.brandSubtitle}>
    <AuthCard title="Verification code" subtitle="You can also use one unused recovery code.">
      <form onSubmit={submit} className="space-y-5">
        <Input autoFocus label="Authenticator or recovery code" value={code} onChange={(event) => setCode(event.target.value.trim())} error={error} autoComplete="one-time-code" inputMode="numeric" />
        <Button type="submit" fullWidth disabled={busy || !code}>{busy ? "Verifying…" : "Verify and sign in"}</Button>
      </form>
      <div className="mt-5 border-t border-[var(--qf-border)] pt-5">
        <p className="text-sm font-semibold text-[var(--qf-text)]">Lost or changed your phone?</p>
        <p className="mt-1 text-xs leading-5 text-[var(--qf-text-muted)]">Receive a one-time code by email. After verification, you can set up a new authenticator QR code.</p>
        {recoveryEmail ? <div className="mt-4 space-y-3"><p role="status" className="rounded-lg bg-[#dcfce7] px-3 py-2 text-xs font-medium text-[#166534]">Code sent to {recoveryEmail}.</p><Input label="Email verification code" value={emailCode} onChange={(event)=>setEmailCode(event.target.value.replace(/\D/g, "").slice(0, 6))} autoComplete="one-time-code" inputMode="numeric"/><Button type="button" variant="secondary" fullWidth disabled={busy||emailCode.length!==6} onClick={()=>void emailRecovery("verify")}>Verify email and continue</Button><button type="button" disabled={busy} onClick={()=>void emailRecovery("send")} className="w-full cursor-pointer text-xs font-semibold text-[var(--qf-accent)] disabled:opacity-60">Send a new code</button></div>:<Button type="button" variant="secondary" fullWidth disabled={busy} className="mt-4" onClick={()=>void emailRecovery("send")}>Email me a recovery code</Button>}
      </div>
    </AuthCard>
  </AuthShell>;
}
