import assert from "node:assert/strict";
import test from "node:test";
import { isValidApplicationEmail } from "../lib/recruiting/email-validation";
import { parseManualApplication } from "../lib/recruiting/application-fields";
import { parseApplicationInput } from "../lib/recruiting/job-fields";
import { getRecruitingMessages } from "../lib/i18n/recruiting-messages";

const base = { firstName: "Maria", lastName: "B", jobId: "068c5ec1-4c6c-4dcb-9603-81cd885623d7" };
for (const email of ["maria-ohne-at", "a@", "@example.com", "a@@example.com", "a b@example.com", "a@example", "a@example..com", "a@-example.com", "a..b@example.com"]) {
  test(`rejects ${email} in manual and public submissions`, () => {
    assert.equal(isValidApplicationEmail(email), false);
    assert.equal(parseManualApplication({ ...base, email }), null);
    assert.equal(parseApplicationInput({ ...base, email }, "classic", false), null);
  });
}
test("accepts valid email and trims spaces", () => {
  const email = " maria+jobs@example.co.uk ";
  assert.equal(isValidApplicationEmail(email), true);
  assert.equal(parseManualApplication({ ...base, email })?.email, email.trim());
  assert.equal(parseApplicationInput({ ...base, email }, "classic", false)?.email, email.trim());
});
test("manual email stays optional; public email is required", () => {
  assert.ok(parseManualApplication(base));
  assert.equal(parseApplicationInput(base, "classic", false), null);
});
test("email error and edit label exist in all three languages", () => {
  const messages = ["en", "de", "it"].map(lang => getRecruitingMessages(lang as "en" | "de" | "it"));
  assert.equal(new Set(messages.map(message => message.emailFormatError)).size, 3);
  for (const message of messages) {
    assert.ok(message.emailFormatError.includes("name@example.com"));
    assert.ok(message.editEmail);
  }
});
