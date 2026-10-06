import assert from "node:assert/strict";
import test from "node:test";
import { buildApplicantAiSummary } from "../lib/recruiting/ai-summary";

test("every language displays its score explanation below the summary", () => {
  for (const [locale, heading] of [["en", "Why this score?"], ["de", "Warum dieser Score?"], ["it", "Perch\u00e9 questo punteggio?"]] as const) {
    const result = buildApplicantAiSummary("Application message: reception experience.", "60/100: experience matches; language level is unknown.", locale);
    assert.ok(result.includes(`\n\n${heading}\n`));
    assert.ok(result.endsWith("language level is unknown."));
  }
});
test("missing score explanations cannot be saved as complete summaries", () => {
  for (const value of [undefined, null, "", "   "]) assert.throws(() => buildApplicantAiSummary("Summary", value, "en"));
  assert.throws(() => buildApplicantAiSummary("", "Reason", "en"));
});
