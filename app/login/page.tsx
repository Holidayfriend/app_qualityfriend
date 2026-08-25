"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthCard } from "../../components/auth/auth-card";
import { AuthShell } from "../../components/auth/auth-shell";
import { LanguageSwitcher } from "../../components/i18n/language-switcher";
import { useI18n } from "../../components/i18n/i18n-provider";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { PasswordInput } from "../../components/ui/password-input";

export default function LoginPage() {
  const { dictionary, setLocale } = useI18n();
  const t = dictionary.login;
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const nextErrors: Record<string, string> = {};
    const email = String(values.email ?? "").trim();
    const password = String(values.password ?? "");
    if (!email) nextErrors.email = dictionary.common.required;
    else if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = dictionary.common.invalidEmail;
    if (!password) nextErrors.password = dictionary.common.required;
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      form.querySelector<HTMLElement>(`[name="${Object.keys(nextErrors)[0]}"]`)?.focus();
      return;
    }
    setErrors({});
    setStatus("submitting");
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);

    if (response?.ok) {
      const result = await response.json();
      if (result.language === "en" || result.language === "de" || result.language === "it") setLocale(result.language);
      router.push("/dashboard");
      return;
    }
    setErrors({ email: t.error, password: t.error });
    setStatus("error");
  }

  return (
    <AuthShell eyebrow={t.eyebrow} title={t.heroTitle} description={t.heroDescription} brandSubtitle={dictionary.common.brandSubtitle}>
      <div className="mb-3 flex justify-end"><LanguageSwitcher /></div>
      <AuthCard title={t.title} subtitle={t.subtitle}>
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
          <Input id="email" name="email" type="email" label={t.email} error={errors.email} placeholder="name@hotel.com" autoComplete="email" />
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--qf-text)]">{t.password}</span>
              <a href="#" className="text-xs font-semibold text-[var(--qf-accent)] hover:underline">{t.forgotPassword}</a>
            </div>
            <PasswordInput id="password" name="password" label="" error={errors.password} showLabel={t.showPassword} hideLabel={t.hidePassword} placeholder={t.passwordPlaceholder} autoComplete="current-password" />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--qf-text-muted)]"><input type="checkbox" name="remember" className="h-4 w-4 accent-[var(--qf-accent)]" />{t.remember}</label>
          <Button type="submit" fullWidth disabled={status === "submitting"}>{status === "submitting" ? t.submitting : t.submit}</Button>
        </form>
        <p className="mt-6 text-center text-[13px] text-[var(--qf-text-muted)]">{t.noAccount} <Link href="/register" className="font-semibold text-[var(--qf-accent)] hover:underline">{t.register}</Link></p>
      </AuthCard>
    </AuthShell>
  );
}
