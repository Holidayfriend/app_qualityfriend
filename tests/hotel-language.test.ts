import assert from "node:assert/strict";
import test from "node:test";
import { fitsHotelLanguage } from "../lib/i18n/hotel-language";

test("hotel translation accepts English, German, and Italian only", () => {
  assert.equal(fitsHotelLanguage("No service"), true);
  assert.equal(fitsHotelLanguage("Kein Service"), true);
  assert.equal(fitsHotelLanguage("Nessun servizio"), true);
  assert.equal(fitsHotelLanguage("Täglich gereinigt"), true);
  assert.equal(fitsHotelLanguage("Läckande kran på våning 2"), false);
  assert.equal(fitsHotelLanguage("Kranen är trasig"), false);
});
