"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard } from "../../components/auth/auth-card";
import { AuthShell } from "../../components/auth/auth-shell";
import { LanguageSwitcher } from "../../components/i18n/language-switcher";
import { useI18n } from "../../components/i18n/i18n-provider";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

export default function ForgotPasswordPage() {
  const { dictionary } = useI18n();
  const t = dictionary.forgotPassword;
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [emailError, setEmailError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = String(new FormData(form).get("email") ?? "").trim();
    if (!email) {
      setEmailError(dictionary.common.required);
      setMessage("");
      setStatus("idle");
      form.querySelector<HTMLElement>('[name="email"]')?.focus();
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setEmailError(dictionary.common.invalidEmail);
      setMessage("");
      setStatus("idle");
      form.querySelector<HTMLElement>('[name="email"]')?.focus();
      return;
    }

    setEmailError("");
    setMessage("");
    setStatus("submitting");
    const response = await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);

    if (response?.ok) {
      setStatus("sent");
      setMessage(t.sent);
      return;
    }
    setStatus("error");
    setMessage(result?.error === "NOT_REGISTERED" ? t.notRegistered : t.sendFailed);
  }

  return (
    <AuthShell eyebrow={t.eyebrow} title={t.heroTitle} description={t.heroDescription} brandSubtitle={dictionary.common.brandSubtitle}>
      <div className="mb-3 flex justify-end"><LanguageSwitcher /></div>
      <AuthCard title={t.title} subtitle={t.subtitle}>
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <Input id="email" name="email" type="email" label={t.email} error={emailError} placeholder="name@hotel.com" autoComplete="email" />
          {status === "sent" ? <p role="status" className="rounded-lg bg-[#dcfce7] px-4 py-3 text-[13px] font-medium text-[#166534]">{message}</p> : null}
          {status === "error" ? <p role="alert" className="rounded-lg bg-[#fee2e2] px-4 py-3 text-[13px] font-medium text-[var(--qf-danger)]">{message}</p> : null}
          <Button type="submit" fullWidth disabled={status === "submitting"}>{status === "submitting" ? t.submitting : t.submit}</Button>
        </form>
        <p className="mt-6 text-center text-[13px] text-[var(--qf-text-muted)]">
          <Link href="/login" className="font-semibold text-[var(--qf-accent)] hover:underline">{t.backToLogin}</Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
