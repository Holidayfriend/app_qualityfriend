import { getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export const defaultPhoneCountry: CountryCode = "IT";

export function phoneNumberParts(value: string | undefined, fallbackCountry: CountryCode = defaultPhoneCountry) {
  const parsed = value ? parsePhoneNumberFromString(value) : undefined;
  return { country: parsed?.country ?? fallbackCountry, nationalNumber: parsed?.nationalNumber ?? "" };
}

export function internationalPhoneNumber(country: CountryCode, nationalNumber: string) {
  const digits = nationalNumber.replace(/\D/g, "");
  if (!digits) return "";
  return parsePhoneNumberFromString(nationalNumber, country)?.number ?? `+${getCountryCallingCode(country)}${digits}`;
}

export function normalizeInternationalPhoneNumber(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const parsed = parsePhoneNumberFromString(value.trim());
  return parsed?.isValid() ? parsed.number : "";
}

export function isValidInternationalPhoneNumber(value: string) {
  return Boolean(normalizeInternationalPhoneNumber(value));
}
