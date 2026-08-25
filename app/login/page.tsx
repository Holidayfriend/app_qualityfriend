"use client";

import Link from "next/link";
import { AuthCard } from "../../components/auth/auth-card";
import { AuthShell } from "../../components/auth/auth-shell";
import { LanguageSwitcher } from "../../components/i18n/language-switcher";
import { useI18n } from "../../components/i18n/i18n-provider";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { PasswordInput } from "../../components/ui/password-input";

export default function LoginPage() {
  const { dictionary } = useI18n();
  const t = dictionary.login;

  return (
    <AuthShell eyebrow={t.eyebrow} title={t.heroTitle} description={t.heroDescription} brandSubtitle={dictionary.common.brandSubtitle}>
      <div className="mb-3 flex justify-end"><LanguageSwitcher /></div>
      <AuthCard title={t.title} subtitle={t.subtitle}>
        <form className="space-y-5">
          <Input id="email" name="email" type="email" label={t.email} placeholder="name@hotel.com" autoComplete="email" required />
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--qf-text)]">{t.password}</span>
              <a href="#" className="text-xs font-semibold text-[var(--qf-accent)] hover:underline">{t.forgotPassword}</a>
            </div>
            <PasswordInput id="password" name="password" label="" showLabel={t.showPassword} hideLabel={t.hidePassword} placeholder={t.passwordPlaceholder} autoComplete="current-password" required />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[var(--qf-text-muted)]"><input type="checkbox" name="remember" className="h-4 w-4 accent-[var(--qf-accent)]" />{t.remember}</label>
          <Button type="submit" fullWidth>{t.submit}</Button>
        </form>
        <p className="mt-6 text-center text-[13px] text-[var(--qf-text-muted)]">{t.noAccount} <Link href="/register" className="font-semibold text-[var(--qf-accent)] hover:underline">{t.register}</Link></p>
      </AuthCard>
    </AuthShell>
  );
}
