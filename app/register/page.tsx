"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthCard } from "../../components/auth/auth-card";
import { AuthShell } from "../../components/auth/auth-shell";
import { LanguageSwitcher } from "../../components/i18n/language-switcher";
import { useI18n } from "../../components/i18n/i18n-provider";
import { listCountries, listProvinces } from "../../lib/geo/locations";
import { BrandLoader } from "../../components/ui/brand-loader";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { PasswordInput } from "../../components/ui/password-input";

function SelectField({ id, name, label, value, error, requiredMark = false, placeholder, options, onChange }: {
  id: string;
  name: string;
  label: string;
  value: string;
  error?: string;
  requiredMark?: boolean;
  placeholder: string;
  options: { code: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-semibold text-[var(--qf-text)]">{label}{requiredMark ? <span aria-hidden="true" className="text-[var(--qf-danger)]"> *</span> : null}</label>
      <select id={id} name={name} value={value} aria-required={requiredMark || undefined} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.value)} className={`h-11 w-full cursor-pointer rounded-lg border bg-white px-3.5 text-sm outline-none transition ${value ? "text-[var(--qf-text)]" : "text-[var(--qf-text-light)]"} ${error ? "border-[var(--qf-danger)] focus:border-[var(--qf-danger)] focus:ring-3 focus:ring-[#fee2e2]" : "border-[var(--qf-border)] hover:border-[#d8d4cc] focus:border-[var(--qf-accent)] focus:ring-3 focus:ring-[var(--qf-accent-soft)]"}`}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
      </select>
      {error ? <p id={errorId} role="alert" className="text-[11px] font-medium text-[var(--qf-danger)]">{error}</p> : null}
    </div>
  );
}

export default function RegisterPage() {
  const { dictionary, locale } = useI18n();
  const router = useRouter();
  const t = dictionary.register;
  const optional = (label: string) => `${label} (${dictionary.common.optional})`;
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error" | "email-exists">("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [country, setCountry] = useState("");
  const [province, setProvince] = useState("");
  const provinces = listProvinces(country, locale);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const nextErrors: Record<string, string> = {};
    const requiredFields = ["company", "hotelName", "firstName", "lastName", "email", "password", "country", "city", "streetAddress", "zip"];
    for (const field of requiredFields) {
      if (!String(values[field] ?? "").trim()) nextErrors[field] = dictionary.common.required;
    }
    if (provinces.length && !province.trim()) nextErrors.province = dictionary.common.required;
    const email = String(values.email ?? "").trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = dictionary.common.invalidEmail;
    const password = String(values.password ?? "");
    if (password && password.length < 8) nextErrors.password = dictionary.common.shortPassword;
    if (values.terms !== "on") nextErrors.terms = dictionary.common.acceptTerms;
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      form.querySelector<HTMLElement>(`[name="${Object.keys(nextErrors)[0]}"]`)?.focus();
      return;
    }
    setErrors({});
    setStatus("submitting");
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, hotelLanguage: locale.toUpperCase() }),
    }).catch(() => null);

    if (response?.ok) {
      const result = await response.json().catch(() => null);
      router.push(result?.redirectTo || "/billing/subscribe");
      return;
    }
    const result = await response?.json().catch(() => null);
    if (result?.error === "EMAIL_EXISTS") {
      setErrors({ email: t.emailExists });
      form.querySelector<HTMLElement>("[name=email]")?.focus();
      setStatus("email-exists");
    } else {
      setStatus("error");
    }
  }

  return (
    <AuthShell wide eyebrow={t.eyebrow} title={t.heroTitle} description={t.heroDescription} brandSubtitle={dictionary.common.brandSubtitle}>
      {status === "submitting" ? <BrandLoader label={t.submitting} overlay /> : null}
      <div className="mb-3 flex justify-end"><LanguageSwitcher /></div>
      <AuthCard title={t.title} subtitle={t.subtitle}>
        <form className="space-y-6" onSubmit={handleSubmit} noValidate>
          <p className="text-[11px] font-medium text-[var(--qf-text-muted)]"><span aria-hidden="true" className="text-[var(--qf-danger)]">*</span> {dictionary.common.requiredMark}</p>
          <fieldset className="space-y-4">
            <legend className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--qf-accent)]">{t.companySection}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="company" name="company" label={t.company} requiredMark error={errors.company} placeholder={t.companyPlaceholder} autoComplete="organization" />
              <Input id="hotel-name" name="hotelName" label={t.hotelName} requiredMark error={errors.hotelName} placeholder={t.hotelNamePlaceholder} />
            </div>
            <Input id="vat-id" name="vatId" label={optional(t.vatId)} placeholder="IT12345678901" />
          </fieldset>
          <fieldset className="space-y-4 border-t border-[var(--qf-border)] pt-5">
            <legend className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--qf-accent)]">{t.contactSection}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="first-name" name="firstName" label={t.firstName} requiredMark error={errors.firstName} autoComplete="given-name" />
              <Input id="last-name" name="lastName" label={t.lastName} requiredMark error={errors.lastName} autoComplete="family-name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="phone" name="phone" type="tel" label={optional(t.phone)} autoComplete="tel" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input id="register-email" name="email" type="email" label={t.email} requiredMark error={errors.email} placeholder="name@hotel.com" autoComplete="email" />
              <PasswordInput id="register-password" name="password" label={t.password} requiredMark error={errors.password} showLabel={t.showPassword} hideLabel={t.hidePassword} placeholder={t.passwordPlaceholder} autoComplete="new-password" strength={{ low: t.passwordLow, medium: t.passwordMedium, strong: t.passwordStrong }} />
            </div>
          </fieldset>
          <fieldset className="space-y-4 border-t border-[var(--qf-border)] pt-5">
            <legend className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--qf-accent)]">{t.addressSection}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField id="country" name="country" label={t.country} requiredMark value={country} error={errors.country} placeholder={t.countryPlaceholder} options={listCountries(locale)} onChange={(value) => { setCountry(value); setProvince(""); }} />
              {provinces.length ? <SelectField id="province" name="province" label={t.province} requiredMark value={province} error={errors.province} placeholder={t.provincePlaceholder} options={provinces} onChange={setProvince} /> : <Input id="city" name="city" label={t.city} requiredMark error={errors.city} autoComplete="address-level2" />}
            </div>
            {provinces.length ? <div className="grid gap-4 sm:grid-cols-2"><Input id="city" name="city" label={t.city} requiredMark error={errors.city} autoComplete="address-level2" /></div> : null}
            <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
              <Input id="street" name="streetAddress" label={t.street} requiredMark error={errors.streetAddress} autoComplete="street-address" />
              <Input id="zip" name="zip" label={t.zip} requiredMark error={errors.zip} autoComplete="postal-code" />
            </div>
          </fieldset>
          <div>
            <label className="flex cursor-pointer items-start gap-2.5 text-[12px] leading-5 text-[var(--qf-text-muted)]"><input type="checkbox" name="terms" required aria-invalid={Boolean(errors.terms)} aria-describedby={errors.terms ? "terms-error" : undefined} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--qf-accent)]" /><span>{t.termsPrefix}<Link href="/terms-of-use" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--qf-accent)] underline underline-offset-2">{t.termsOfUse}</Link>{t.termsJoiner}<Link href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--qf-accent)] underline underline-offset-2">{t.privacyPolicy}</Link>{t.termsSuffix}<span aria-hidden="true" className="text-[var(--qf-danger)]"> *</span></span></label>
            {errors.terms ? <p id="terms-error" role="alert" className="ml-6.5 mt-1 text-[11px] font-medium text-[var(--qf-danger)]">{errors.terms}</p> : null}
          </div>
          {status === "success" ? <p role="status" className="rounded-lg bg-[#dcfce7] px-4 py-3 text-[13px] font-medium text-[#166534]">{t.success}</p> : null}
          {status === "error" ? <p role="alert" className="rounded-lg bg-[#fee2e2] px-4 py-3 text-[13px] font-medium text-[var(--qf-danger)]">{t.error}</p> : null}
          <Button type="submit" fullWidth disabled={status === "submitting"}>{status === "submitting" ? t.submitting : t.submit}</Button>
        </form>
        <p className="mt-6 text-center text-[13px] text-[var(--qf-text-muted)]">{t.hasAccount} <Link href="/login" className="font-semibold text-[var(--qf-accent)] hover:underline">{t.login}</Link></p>
      </AuthCard>
    </AuthShell>
  );
}
