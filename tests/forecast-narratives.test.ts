import assert from "node:assert/strict";
import test from "node:test";
import { narrativeFromAi } from "../lib/revenue/narratives";

const fallback = { en: "English fallback text for the banner.", de: "Deutscher Ersatztext für das Banner.", it: "Testo italiano di riserva per il banner." };

test("an AI summary keeps all three languages", () => {
  const text = narrativeFromAi({ en: "Raise the rate on the two busy nights.", de: "Erhöhen Sie den Preis an den zwei vollen Nächten.", it: "Aumentate la tariffa nelle due notti piene." }, fallback);
  assert.equal(text.en.startsWith("Raise"), true);
  assert.equal(text.de.startsWith("Erhöhen"), true);
  assert.equal(text.it.startsWith("Aumentate"), true);
});

test("the same English sentence copied into every language is replaced", () => {
  const copy = "date 2026-11-09 occupancy 11; current 306 recommended 306 status OPTIMAL.";
  const text = narrativeFromAi({ en: copy, de: copy, it: copy }, fallback);
  assert.equal(text.en, fallback.en);
  assert.equal(text.de, fallback.de);
  assert.equal(text.it, fallback.it);
});

test("a long hotel list is replaced by the short fallback", () => {
  const list = "Hotel A 100, Hotel B 200, Hotel C 300, Hotel D 400, Hotel E 500, Hotel F 600, Hotel G 700.";
  const text = narrativeFromAi({ en: list, de: list, it: list }, fallback);
  assert.equal(text.en, fallback.en);
  assert.equal(text.de, fallback.de);
  assert.equal(text.it, fallback.it);
});

test("a missing language uses the factual fallback", () => {
  const text = narrativeFromAi({ en: "too short", de: "Der empfohlene Preis bleibt nahe am aktuellen ADR." }, fallback);
  assert.equal(text.en, fallback.en);
  assert.equal(text.de.startsWith("Der empfohlene"), true);
  assert.equal(text.it, fallback.it);
});
