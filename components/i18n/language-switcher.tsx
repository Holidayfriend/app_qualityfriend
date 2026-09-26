"use client";

import { useI18n } from "./i18n-provider";
import type { Locale } from "../../lib/i18n/dictionaries";

const languages: { value: Locale; label: string }[] = [
  { value: "en", label: "English" }, { value: "de", label: "Deutsch" }, { value: "it", label: "Italiano" },
];
const independentLabels: Record<Locale, string> = { en: "Language", de: "Sprache", it: "Lingua" };

export function LanguageSwitcher({ iconOnly = false, locales, locale: controlledLocale, onLocaleChange }: {
  iconOnly?: boolean;
  locales?: Locale[];
  locale?: Locale;
  onLocaleChange?: (locale: Locale) => void;
}) {
  const i18n = useI18n();
  const independent = typeof onLocaleChange === "function";
  const locale = controlledLocale ?? i18n.locale;
  const options = locales?.length ? languages.filter((language) => locales.includes(language.value)) : languages;
  if (independent && options.length < 2) return null;
  const value = options.some((language) => language.value === locale) ? locale : options[0]?.value ?? locale;
  const caption = independent ? independentLabels[value] : i18n.dictionary.common.language;
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-[var(--qf-text-muted)]">
      {iconOnly ? null : caption}
      <select aria-label={caption} value={value} onChange={(event) => {
        const nextLocale = event.target.value as Locale;
        if (onLocaleChange) {
          onLocaleChange(nextLocale);
          return;
        }
        i18n.setLocale(nextLocale);
        fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: nextLocale }) }).catch(() => undefined);
      }} className="h-9 rounded-lg border border-[var(--qf-border)] bg-white px-3 text-[13px] text-[var(--qf-text)] outline-none focus:border-[var(--qf-accent)]">
        {options.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}
      </select>
    </label>
  );
}
