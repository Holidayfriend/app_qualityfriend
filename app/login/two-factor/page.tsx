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
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Verification could not be completed. Please try again.");
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
    </AuthCard>
  </AuthShell>;
}
