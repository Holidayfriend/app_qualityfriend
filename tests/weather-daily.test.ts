import assert from "node:assert/strict";
import test from "node:test";
import { firstRainHour, hotelAddressKey, weatherFromCode } from "../lib/weather/codes";

test("weather codes map to dashboard icons and labels", () => {
  assert.deepEqual(weatherFromCode(0), { conditionKey: "clear", icon: "☀️" });
  assert.deepEqual(weatherFromCode(2), { conditionKey: "partlyCloudy", icon: "⛅" });
  assert.equal(weatherFromCode(61).conditionKey, "rain");
  assert.equal(weatherFromCode(95).icon, "⛈️");
});

test("first rain hour uses forecast local time after the current hour", () => {
  const times = ["2026-09-16T14:00", "2026-09-16T15:00", "2026-09-16T16:00"];
  const precipitation = [0, 0, 1.2];
  assert.equal(firstRainHour(times, precipitation, "2026-09-16T14:00"), "16:00");
  assert.equal(firstRainHour(times, precipitation, "2026-09-16T17:00"), null);
});

test("address key changes when the hotel city changes", () => {
  const hotel = { streetAddress: "Via Principale 1", postalCode: "39054", city: "Ritten", country: "Italy" };
  assert.notEqual(hotelAddressKey(hotel), hotelAddressKey({ ...hotel, city: "Bolzano" }));
});
