"use client";

import { useMemo } from "react";
import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import type { Locale } from "../../lib/i18n/dictionaries";

const flag = (country: CountryCode) => String.fromCodePoint(...country.split("").map((letter) => 127397 + letter.charCodeAt(0)));

type Props = { country: CountryCode; number: string; locale: Locale; countryLabel: string; numberLabel: string; invalid?: boolean; onCountryChange: (country: CountryCode) => void; onNumberChange: (number: string) => void };

export function CountryPhoneInput({ country, number, locale, countryLabel, numberLabel, invalid = false, onCountryChange, onNumberChange }: Props) {
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    const collator = new Intl.Collator(locale);
    return getCountries().map((code) => ({ code, name: names.of(code) || code, dial: getCountryCallingCode(code) })).sort((a, b) => collator.compare(a.name, b.name));
  }, [locale]);
  return <div className={`country-phone-input${invalid ? " is-invalid" : ""}`}>
    <select className="field-select" aria-label={countryLabel} value={country} onChange={(event) => onCountryChange(event.target.value as CountryCode)}>
      {countries.map((item) => <option key={item.code} value={item.code}>{flag(item.code)} {item.name} (+{item.dial})</option>)}
    </select>
    <div className="country-phone-number"><span aria-hidden="true">+{getCountryCallingCode(country)}</span><input className="field-input" type="tel" inputMode="tel" autoComplete="tel-national" aria-label={numberLabel} aria-invalid={invalid} value={number} onChange={(event) => onNumberChange(event.target.value)} placeholder="123 456 7890" /></div>
  </div>;
}
