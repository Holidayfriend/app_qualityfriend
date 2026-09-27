"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard } from "../../components/auth/auth-card";
import { AuthShell } from "../../components/auth/auth-shell";
import { LanguageSwitcher } from "../../components/i18n/language-switcher";
import { useI18n } from "../../components/i18n/i18n-provider";
import { Button } from "../../components/ui/button";
import { PasswordInput } from "../../components/ui/password-input";

export function ResetPasswordForm({ token }: { token: string }) {
  const { dictionary } = useI18n();
  const t = dictionary.resetPassword;
  const login = dictionary.login;
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState(token ? "" : t.missing);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password") ?? "");
    const confirm = String(values.get("confirm") ?? "");
    const nextErrors: Record<string, string> = {};
    if (!password) nextErrors.password = dictionary.common.required;
    else if (password.length < 8) nextErrors.password = dictionary.common.shortPassword;
    if (!confirm) nextErrors.confirm = dictionary.common.required;
    else if (password && confirm !== password) nextErrors.confirm = t.mismatch;
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setMessage("");
      setStatus("idle");
      form.querySelector<HTMLElement>(`[name="${Object.keys(nextErrors)[0]}"]`)?.focus();
      return;
    }

    setErrors({});
    setMessage("");
    setStatus("submitting");
    const response = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    if (response?.ok) {
      setStatus("success");
      setMessage(t.success);
      return;
    }
    setStatus("error");
    setMessage(result?.error === "SHORT_PASSWORD" ? dictionary.common.shortPassword : result?.error === "INVALID_TOKEN" ? t.invalid : t.failed);
  }

  return (
    <AuthShell eyebrow={t.eyebrow} title={t.heroTitle} description={t.heroDescription} brandSubtitle={dictionary.common.brandSubtitle}>
      <div className="mb-3 flex justify-end"><LanguageSwitcher /></div>
      <AuthCard title={t.title} subtitle={t.subtitle}>
        {token && status !== "success" ? (
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <PasswordInput id="password" name="password" label={t.password} error={errors.password} showLabel={login.showPassword} hideLabel={login.hidePassword} placeholder={t.passwordPlaceholder} autoComplete="new-password" />
            <PasswordInput id="confirm" name="confirm" label={t.confirm} error={errors.confirm} showLabel={login.showPassword} hideLabel={login.hidePassword} placeholder={t.confirmPlaceholder} autoComplete="new-password" />
            {status === "error" ? <p role="alert" className="rounded-lg bg-[#fee2e2] px-4 py-3 text-[13px] font-medium text-[var(--qf-danger)]">{message}</p> : null}
            <Button type="submit" fullWidth disabled={status === "submitting"}>{status === "submitting" ? t.submitting : t.submit}</Button>
          </form>
        ) : (
          <p role="status" className={`rounded-lg px-4 py-3 text-[13px] font-medium ${status === "success" ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fee2e2] text-[var(--qf-danger)]"}`}>{token ? message : t.missing}</p>
        )}
        <p className="mt-6 text-center text-[13px] text-[var(--qf-text-muted)]">
          <Link href="/login" className="font-semibold text-[var(--qf-accent)] hover:underline">{t.signIn}</Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
