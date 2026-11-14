import type { HotelSettingsValues } from "../../components/settings/hotel-settings-form";
import { listProvinces, resolveAddress } from "../geo/locations";
import { parseStarCategory } from "../hotel/star-category";

export type AccountMessages = { required: string; invalidEmail: string; invalidFileName: string };

const emailPattern = /^\S+@\S+\.\S+$/;
const legalForms = new Set(["SOLE", "SNC", "SAS", "SRL", "SPA", "OTHER"]);
const languages = new Set(["EN", "DE", "IT"]);

function blank(value: string) {
  return !value.trim();
}

function clockInvalid(value: string) {
  const trimmed = value.trim();
  return Boolean(trimmed) && !/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.test(trimmed);
}

function fileNameInvalid(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return trimmed.length > 255 || /[\\/<>:"|?*\u0000-\u001f\u007f]/.test(trimmed) || trimmed === "." || trimmed === ".." || /[. ]$/.test(trimmed);
}

export function hotelNameKey(locale: string): "hotelNameEn" | "hotelNameDe" | "hotelNameIt" {
  return locale === "de" ? "hotelNameDe" : locale === "it" ? "hotelNameIt" : "hotelNameEn";
}

export function userAccountErrors(user: { firstName: string; lastName: string; email: string; language: string }, messages: AccountMessages) {
  const errors: Partial<Record<"firstName" | "lastName" | "email" | "language", string>> = {};
  if (blank(user.firstName)) errors.firstName = messages.required;
  if (blank(user.lastName)) errors.lastName = messages.required;
  if (blank(user.email)) errors.email = messages.required;
  if (!languages.has(user.language.trim().toUpperCase())) errors.language = messages.required;
  return errors;
}

export function hotelAccountErrors(hotel: HotelSettingsValues & { dataProtection?: string; privacyPolicy?: string }, locale: string, messages: AccountMessages) {
  const errors: Partial<Record<keyof HotelSettingsValues | "dataProtection" | "privacyPolicy", string>> = {};
  const visibleName = hotelNameKey(locale);
  if (blank(hotel[visibleName])) errors[visibleName] = messages.required;
  if (blank(hotel.email)) errors.email = messages.required;
  if (blank(hotel.companyName)) errors.companyName = messages.required;
  if (blank(hotel.streetAddress)) errors.streetAddress = messages.required;
  if (blank(hotel.postalCode)) errors.postalCode = messages.required;
  if (blank(hotel.city)) errors.city = messages.required;
  if (blank(hotel.contactPerson)) errors.contactPerson = messages.required;
  if (blank(hotel.country) || !resolveAddress(hotel.country, hotel.province)) {
    if (!blank(hotel.country) && listProvinces(hotel.country).length) errors.province = messages.required;
    else errors.country = messages.required;
  }
  if (!languages.has(hotel.hotelLanguage.trim().toUpperCase())) errors.hotelLanguage = messages.required;
  if (hotel.roomCount.trim()) {
    const count = Number(hotel.roomCount.trim());
    if (!Number.isInteger(count) || count < 0 || count > 10000) errors.roomCount = messages.required;
  }
  if (parseStarCategory(hotel.starRating) === undefined) errors.starRating = messages.required;
  if (clockInvalid(hotel.checkInTime)) errors.checkInTime = messages.required;
  if (clockInvalid(hotel.checkOutTime)) errors.checkOutTime = messages.required;
  if (hotel.invoiceEmail.trim() && !emailPattern.test(hotel.invoiceEmail.trim())) errors.invoiceEmail = messages.invalidEmail;
  if (hotel.pecAddress.trim() && !emailPattern.test(hotel.pecAddress.trim())) errors.pecAddress = messages.invalidEmail;
  if (hotel.sdiCode.trim() && !/^[A-Za-z0-9]{6,7}$/.test(hotel.sdiCode.trim())) errors.sdiCode = messages.required;
  if (hotel.legalForm.trim() && !legalForms.has(hotel.legalForm)) errors.legalForm = messages.required;
  if (hotel.pmsName.trim().length > 80) errors.pmsName = messages.required;
  if (fileNameInvalid(hotel.asaXmlName)) errors.asaXmlName = messages.invalidFileName;
  if (fileNameInvalid(hotel.forecastXmlName)) errors.forecastXmlName = messages.invalidFileName;
  if ((hotel.dataProtection?.length ?? 0) > 200000) errors.dataProtection = messages.required;
  if ((hotel.privacyPolicy?.length ?? 0) > 200000) errors.privacyPolicy = messages.required;
  return errors;
}

const messageKey: Partial<Record<string, keyof AccountMessages>> = {
  invoiceEmail: "invalidEmail",
  pecAddress: "invalidEmail",
  asaXmlName: "invalidFileName",
  forecastXmlName: "invalidFileName",
};

export function errorsFromServerFields(fields: string[], locale: string, messages: AccountMessages) {
  const errors: Record<string, string> = {};
  const visibleName = hotelNameKey(locale);
  for (const field of fields) {
    const key = field === "hotelNameEn" || field === "hotelNameDe" || field === "hotelNameIt" ? visibleName : field;
    errors[key] = messages[messageKey[key] ?? "required"];
  }
  return errors;
}
