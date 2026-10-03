import assert from "node:assert/strict";
import test from "node:test";
import { localizeExtraJobInput, extraJobDescription, extraJobInput, extraJobSnapshot } from "../lib/housekeeping/extra-job-fields";

for (const [locale, field] of [["en", "descriptionEn"], ["de", "descriptionDe"], ["it", "descriptionIt"]] as const) {
  test(`${locale} input validation ignores injected translation fields`, () => {
    const before = { descriptionEn: "English", descriptionDe: "Deutsch", descriptionIt: "Italiano", minutes: 30 };
    const input = extraJobInput({ locale, description: " Updated ", minutes: 45, descriptionEn: "overwrite", descriptionDe: "overwrite", descriptionIt: "overwrite", hotelTenantId: "another-hotel" });
    assert.ok(input);
    const after = { ...before, ...input.data };
    assert.deepEqual(after, { ...before, [field]: "Updated", minutes: 45 });
    assert.equal(Object.keys(input.data).length, 2);
    assert.equal(extraJobSnapshot(after).minutes, 45);
  });
}

test("rejects unsupported locales, missing descriptions and invalid times", () => {
  const valid = { locale: "en", description: "Clean sauna", minutes: 30 };
  for (const override of [{ locale: "fr" }, { locale: null }, { description: " " }, { description: "a".repeat(5001) }, { minutes: -1 }, { minutes: 1.5 }, { minutes: "30" }, { minutes: null }, { minutes: 2147483648 }]) {
    assert.equal(extraJobInput({ ...valid, ...override }), null);
  }
  assert.equal(extraJobInput(null), null);
  assert.ok(extraJobInput({ ...valid, minutes: 0 }));
});


test("additional jobs show an existing description when the selected translation is missing", () => {
  const job = { descriptionEn: " ", descriptionDe: "Sauna reinigen", descriptionIt: "Pulire la sauna" };
  assert.equal(extraJobDescription(job, "en"), "Sauna reinigen");
  assert.equal(extraJobDescription(job, "it"), "Pulire la sauna");
  assert.equal(extraJobDescription({ descriptionEn: "", descriptionDe: "", descriptionIt: "" }, "en"), "");
});

for (const locale of ["en", "de", "it"] as const) {
  test(locale + " save translates the other languages and preserves the full entered description", async () => {
    const source = "Source description ".repeat(20).trim();
    const input = extraJobInput({ locale, description: source, minutes: 45 });
    assert.ok(input);
    let calls = 0;
    const data = await localizeExtraJobInput(input, async (language, description) => {
      calls++;
      assert.equal(language, locale);
      assert.equal(description, source);
      return { en: "English", de: "Deutsch", it: "Italiano" };
    });
    assert.equal(calls, 1);
    assert.deepEqual(extraJobSnapshot(data), { ...{ en: "English", de: "Deutsch", it: "Italiano" }, [locale]: source, minutes: 45 });
  });
}
