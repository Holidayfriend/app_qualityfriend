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

export default function RegisterPage() {
  const { dictionary, locale } = useI18n();
  const router = useRouter();
  const t = dictionary.register;
  const optional = (label: string) => `${label} (${dictionary.common.optional})`;
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error" | "email-exists">("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, hotelLanguage: locale.toUpperCase() }),
    }).catch(() => null);

    if (response?.ok) {
      router.push("/dashboard");
      return;
    }
    const result = await response?.json().catch(() => null);
    setStatus(result?.error === "EMAIL_EXISTS" ? "email-exists" : "error");
  }

  return (
    <AuthShell wide eyebrow={t.eyebrow} title={t.heroTitle} description={t.heroDescription} brandSubtitle={dictionary.common.brandSubtitle}>
      <div className="mb-3 flex justify-end"><LanguageSwitcher /></div>
      <AuthCard title={t.title} subtitle={t.subtitle}>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <fieldset className="space-y-4">
            <legend className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--qf-accent)]">{t.companySection}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="company" name="company" label={t.company} placeholder="QualityFriend GmbH" autoComplete="organization" required />
              <Input id="hotel-name" name="hotelName" label={t.hotelName} placeholder="Hotel Weihrerhof" required />
            </div>
            <Input id="vat-id" name="vatId" label={optional(t.vatId)} placeholder="IT12345678901" />
          </fieldset>
          <fieldset className="space-y-4 border-t border-[var(--qf-border)] pt-5">
            <legend className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--qf-accent)]">{t.contactSection}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="first-name" name="firstName" label={t.firstName} autoComplete="given-name" required />
              <Input id="last-name" name="lastName" label={t.lastName} autoComplete="family-name" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="contact-person" name="contactPerson" label={t.contactPerson} autoComplete="name" required />
              <Input id="phone" name="phone" type="tel" label={optional(t.phone)} autoComplete="tel" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="register-email" name="email" type="email" label={t.email} placeholder="name@hotel.com" autoComplete="email" required />
              <PasswordInput id="register-password" name="password" label={t.password} showLabel={t.showPassword} hideLabel={t.hidePassword} placeholder={t.passwordPlaceholder} autoComplete="new-password" minLength={8} required />
            </div>
          </fieldset>
          <fieldset className="space-y-4 border-t border-[var(--qf-border)] pt-5">
            <legend className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--qf-accent)]">{t.addressSection}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="country" name="country" label={t.country} autoComplete="country-name" required />
              <Input id="city" name="city" label={t.city} autoComplete="address-level2" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
              <Input id="street" name="streetAddress" label={t.street} autoComplete="street-address" required />
              <Input id="zip" name="zip" label={t.zip} autoComplete="postal-code" required />
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-5 text-[var(--qf-text-muted)]"><input type="checkbox" name="terms" required className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--qf-accent)]" /><span>{t.terms}</span></label>
          {status === "success" ? <p role="status" className="rounded-lg bg-[#dcfce7] px-4 py-3 text-[13px] font-medium text-[#166534]">{t.success}</p> : null}
          {status === "email-exists" || status === "error" ? <p role="alert" className="rounded-lg bg-[#fee2e2] px-4 py-3 text-[13px] font-medium text-[var(--qf-danger)]">{status === "email-exists" ? t.emailExists : t.error}</p> : null}
          <Button type="submit" fullWidth disabled={status === "submitting"}>{status === "submitting" ? t.submitting : t.submit}</Button>
        </form>
        <p className="mt-6 text-center text-[13px] text-[var(--qf-text-muted)]">{t.hasAccount} <Link href="/login" className="font-semibold text-[var(--qf-accent)] hover:underline">{t.login}</Link></p>
      </AuthCard>
    </AuthShell>
  );
}
