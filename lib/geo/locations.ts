import locations from "../../public/countries+states.json";

type Location = { name: string; states: string[] };

const countries = (locations as Location[])
  .map((country) => ({ name: country.name, states: [...country.states].sort((a, b) => a.localeCompare(b)) }))
  .sort((a, b) => a.name.localeCompare(b));

const byName = new Map(countries.map((country) => [country.name, country]));

export function listCountries() {
  return countries.map((country) => country.name);
}

export function listProvinces(countryName: string) {
  return byName.get(countryName)?.states ?? [];
}

export function resolveAddress(countryName: string, provinceName: string) {
  const country = byName.get(countryName);
  if (!country) return null;
  if (country.states.length === 0) return { country: country.name, province: null };
  if (!country.states.includes(provinceName)) return null;
  return { country: country.name, province: provinceName };
}
