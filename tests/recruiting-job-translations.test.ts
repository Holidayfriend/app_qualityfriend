import assert from "node:assert/strict";
import test from "node:test";
import { jobTranslationPatch } from "../lib/recruiting/job-translations";
import { toPublicJob } from "../lib/recruiting/job-fields";
import type { RecruitingJob } from "../app/generated/prisma/client";

const fields = { title: "Service 2027", notes: "Accommodation possible", description: "<p>April 2027</p>" };
const translated = {
  en: { title: "Service 2027", notes: "Accommodation possible", description: "<p>April 2027</p>" },
  de: { title: "Servicekraft 2027", notes: "Unterkunft m?glich", description: "<p>April 2027</p>" },
  it: { title: "Cameriere 2027", notes: "Alloggio possibile", description: "<p>Aprile 2027</p>" },
};

for (const source of ["en", "de", "it"] as const) {
  test(`preserves ${source} source and translates the other languages`, () => {
    const patch = jobTranslationPatch(source, fields, translated);
    const sourceKey = source === "en" ? "title" : source === "de" ? "titleDe" : "titleIt";
    assert.equal(patch[sourceKey], fields.title);
    const job = { ...patch, languages: ["en", "de", "it"], format: "CLASSIC", status: "DRAFT", autoMessage: "", autoMessageDe: "", autoMessageIt: "", location: "", locationDe: "", locationIt: "" } as unknown as RecruitingJob;
    for (const lang of ["en", "de", "it"] as const) {
      const localized = toPublicJob(job, 0, lang);
      assert.equal(localized.notes, lang === source ? fields.notes : translated[lang].notes);
      assert.equal(localized.description, lang === source ? fields.description : translated[lang].description);
    }
  });
}

test("clearing benefits clears every translation", () => {
  const patch = jobTranslationPatch("en", { ...fields, notes: "" }, translated);
  assert.equal(patch.notes, "");
  assert.equal(patch.notesDe, "");
  assert.equal(patch.notesIt, "");
});

test("incomplete translations fail instead of copying source text", () => {
  assert.throws(() => jobTranslationPatch("en", fields, {}));
  assert.throws(() => jobTranslationPatch("en", fields, { ...translated, it: { ...translated.it, notes: "" } }));
});

test("translated HTML is sanitized", () => {
  const patch = jobTranslationPatch("en", fields, { ...translated, de: { ...translated.de, description: "<p>April</p><script>alert(1)</script>" } });
  assert.equal(patch.descriptionDe, "<p>April</p>");
});
