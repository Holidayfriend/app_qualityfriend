import assert from "node:assert/strict";
import test from "node:test";
import { canonicalCountry, canonicalProvince, countryName, listProvinces, resolveAddress } from "../lib/geo/locations";

const regions = ["Abruzzo", "Apulia", "Basilicata", "Calabria", "Campania", "Emilia-Romagna", "Lazio", "Liguria", "Lombardy", "Marche", "Molise", "Piedmont", "Sardinia", "Sicily", "Trentino-South Tyrol", "Tuscany", "Umbria", "Veneto", "Aosta Valley"];

test("Italy stores province codes and hides regions", () => {
  const provinces = listProvinces("IT", "de");
  assert.equal(provinces.length, 107);
  assert.equal(provinces.find((item) => item.code === "BZ")?.label, "Südtirol (BZ)");
  assert.equal(listProvinces("Italy", "it").find((item) => item.code === "BZ")?.label, "Bolzano (BZ)");
  assert.equal(listProvinces("IT", "en").find((item) => item.code === "TN")?.label, "Trentino (TN)");
  for (const region of regions) {
    assert.equal(provinces.some((item) => item.label.startsWith(region)), false);
  }
  assert.equal(resolveAddress("IT", "Abruzzo"), null);
  assert.equal(resolveAddress("IT", "Trentino-South Tyrol"), null);
  assert.deepEqual(resolveAddress("IT", "Aosta Valley"), { country: "IT", province: "AO" });
});

test("country and province codes stay stable across languages", () => {
  assert.equal(countryName("IT", "de"), "Italien");
  assert.equal(countryName("IT", "it"), "Italia");
  assert.equal(countryName("Italien", "en"), "Italy");
  assert.deepEqual(resolveAddress("Italy", "South Tyrol"), { country: "IT", province: "BZ" });
  assert.deepEqual(resolveAddress("IT", "BZ"), { country: "IT", province: "BZ" });
  assert.deepEqual(resolveAddress("Deutschland", "Bayern"), { country: "DE", province: "BY" });
  assert.equal(canonicalCountry("Italy"), "IT");
  assert.equal(canonicalProvince("Italy", "South Tyrol"), "BZ");
  assert.equal(canonicalProvince("IT", "BZ"), "BZ");
});
