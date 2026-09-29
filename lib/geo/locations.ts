import locations from "../../public/countries+states.json";

type GeoLocale = "en" | "de" | "it";
type Names = { en: string; de: string; it: string };
type Province = { code: string; name: Names; aliases?: string[] };
type Country = { code: string; name: Names; aliases?: string[]; provinces: Province[] };

export type GeoOption = { code: string; label: string };

const countries = locations as Country[];

const legacyProvinceNames: Record<string, Record<string, string>> = {
  IT: {
    "aosta valley": "AO",
    "valle d'aosta": "AO",
    "vallée d'aoste": "AO",
  },
};

const byCountryKey = new Map<string, Country>();
for (const country of countries) {
  byCountryKey.set(country.code.toUpperCase(), country);
  for (const value of [country.name.en, country.name.de, country.name.it, ...(country.aliases ?? [])]) {
    byCountryKey.set(value.trim().toLowerCase(), country);
  }
}

const provinceKeys = new Map<Country, Map<string, Province>>();

function localeOf(locale: string): GeoLocale {
  return locale === "de" || locale === "it" ? locale : "en";
}

function localized(names: Names, locale: string) {
  return names[localeOf(locale)] || names.en;
}

function findCountry(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return byCountryKey.get(trimmed.toUpperCase()) ?? byCountryKey.get(trimmed.toLowerCase());
}

function provincesOf(country: Country) {
  const existing = provinceKeys.get(country);
  if (existing) return existing;
  const map = new Map<string, Province>();
  for (const province of country.provinces) {
    map.set(province.code.toUpperCase(), province);
    for (const value of [province.name.en, province.name.de, province.name.it, ...(province.aliases ?? [])]) {
      map.set(value.trim().toLowerCase(), province);
    }
  }
  for (const [name, code] of Object.entries(legacyProvinceNames[country.code] ?? {})) {
    const province = country.provinces.find((item) => item.code === code);
    if (province) map.set(name, province);
  }
  provinceKeys.set(country, map);
  return map;
}

function findProvince(country: Country, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const map = provincesOf(country);
  return map.get(trimmed.toUpperCase()) ?? map.get(trimmed.toLowerCase());
}

export function listCountries(locale = "en"): GeoOption[] {
  const language = localeOf(locale);
  return countries
    .map((country) => ({ code: country.code, label: localized(country.name, language) }))
    .sort((a, b) => a.label.localeCompare(b.label, language));
}

export function listProvinces(countryValue: string, locale = "en"): GeoOption[] {
  const country = findCountry(countryValue);
  if (!country) return [];
  const language = localeOf(locale);
  return country.provinces
    .map((province) => ({ code: province.code, label: `${localized(province.name, language)} (${province.code})` }))
    .sort((a, b) => a.label.localeCompare(b.label, language));
}

export function countryName(value: string, locale = "en") {
  const country = findCountry(value);
  return country ? localized(country.name, locale) : value;
}

export function canonicalCountry(value: string) {
  return findCountry(value)?.code ?? value.trim();
}

export function canonicalProvince(countryValue: string, provinceValue: string) {
  const country = findCountry(countryValue);
  if (!country) return provinceValue.trim();
  return findProvince(country, provinceValue)?.code ?? provinceValue.trim();
}

export function resolveAddress(countryValue: string, provinceValue: string) {
  const country = findCountry(countryValue);
  if (!country) return null;
  if (country.provinces.length === 0) return { country: country.code, province: null };
  const province = findProvince(country, provinceValue);
  if (!province) return null;
  return { country: country.code, province: province.code };
}
