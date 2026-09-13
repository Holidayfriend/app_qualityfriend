import assert from "node:assert/strict";
import test from "node:test";
import { extraJobInput, extraJobSnapshot } from "../lib/housekeeping/extra-job-fields";

for (const [locale, field] of [["en", "descriptionEn"], ["de", "descriptionDe"], ["it", "descriptionIt"]] as const) {
  test(`${locale} edits preserve the other translations and ignore injected fields`, () => {
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
