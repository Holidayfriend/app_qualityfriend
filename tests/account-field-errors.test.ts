import assert from "node:assert/strict";
import test from "node:test";
import type { HotelSettingsValues } from "../components/settings/hotel-settings-form";
import { listProvinces } from "../lib/geo/locations";
import { hotelAccountErrors } from "../lib/settings/account-field-errors";

const messages = { required: "required", invalidEmail: "email", invalidFileName: "file" };

function hotel(patch: Partial<HotelSettingsValues> = {}): HotelSettingsValues {
  const province = listProvinces("IT")[0]?.code ?? "";
  return {
    hotelNameEn: "Hotel", hotelNameDe: "Hotel", hotelNameIt: "Hotel", email: "hotel@example.com", logoUrl: "", companyName: "Company",
    streetAddress: "Main 1", postalCode: "39012", city: "Merano", country: "IT", province, contactPerson: "Ada",
    phoneNumber: "", vatId: "", tripadvisorId: "", asaXmlName: "", forecastXmlName: "", timeZone: "Europe/Rome", hotelLanguage: "DE",
    pecAddress: "", invoiceEmail: "", sdiCode: "", legalForm: "", roomCount: "", starRating: "", seasonal: false,
    openingPeriod: "", closurePeriod: "", checkInTime: "", checkOutTime: "", pmsName: "", ...patch,
  };
}

test("a filled hotel has no required-field errors", () => {
  assert.deepEqual(hotelAccountErrors(hotel(), "de", messages), {});
});

test("the first missing required values are reported even when a province code is only non-empty", () => {
  const errors = hotelAccountErrors(hotel({ companyName: "  ", province: "not-a-province" }), "de", messages);
  assert.equal(errors.companyName, "required");
  assert.equal(errors.province, "required");
  assert.equal(errors.hotelNameDe, undefined);
});

test("an invalid invoice email is marked", () => {
  assert.equal(hotelAccountErrors(hotel({ invoiceEmail: "not-an-email" }), "en", messages).invoiceEmail, "email");
});
