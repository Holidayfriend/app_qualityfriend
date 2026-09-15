"use client";

import { useI18n } from "./i18n-provider";
import type { Locale } from "../../lib/i18n/dictionaries";

const languages: { value: Locale; label: string }[] = [
  { value: "en", label: "English" }, { value: "de", label: "Deutsch" }, { value: "it", label: "Italiano" },
];

export function LanguageSwitcher({ iconOnly = false, locales }: { iconOnly?: boolean; locales?: Locale[] }) {
  const { locale, setLocale, dictionary } = useI18n();
  const options = locales?.length ? languages.filter((language) => locales.includes(language.value)) : languages;
  const value = options.some((language) => language.value === locale) ? locale : options[0]?.value ?? locale;
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-[var(--qf-text-muted)]">
      {iconOnly ? <span aria-hidden="true" className="text-base">🌐</span> : dictionary.common.language}
      <select value={value} onChange={(event) => {
        const nextLocale = event.target.value as Locale;
        setLocale(nextLocale);
        fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: nextLocale }) }).catch(() => undefined);
      }} className="h-9 rounded-lg border border-[var(--qf-border)] bg-white px-3 text-[13px] text-[var(--qf-text)] outline-none focus:border-[var(--qf-accent)]">
        {options.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
      </select>
    </label>
  );
}
