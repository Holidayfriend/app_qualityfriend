import test from "node:test";
import assert from "node:assert/strict";
import { parseJobInput } from "../lib/recruiting/job-fields";
import { internationalPhoneNumber, normalizeInternationalPhoneNumber } from "../lib/recruiting/phone-number";

const baseJob = {
  format: "classic",
  status: "draft",
  title: "Laravel developer",
  departmentId: "11111111-1111-4111-8111-111111111111",
  workType: "full",
};

test("normalizes national WhatsApp numbers using the selected country", () => {
  assert.equal(internationalPhoneNumber("PK", "0300 1234567"), "+923001234567");
  assert.equal(internationalPhoneNumber("IT", "0471 123456"), "+390471123456");
  assert.equal(normalizeInternationalPhoneNumber("+92 300 1234567"), "+923001234567");
});

test("accepts and canonicalizes an enabled WhatsApp number", () => {
  const input = parseJobInput({ ...baseJob, whatsappEnabled: true, whatsappNumber: "+92 300 1234567" });
  assert.ok(input);
  assert.equal(input.whatsappEnabled, true);
  assert.equal(input.whatsappNumber, "+923001234567");
});

test("rejects an enabled job with an invalid WhatsApp number", () => {
  assert.equal(parseJobInput({ ...baseJob, whatsappEnabled: true, whatsappNumber: "+92 123" }), null);
});

test("drops an invalid WhatsApp number when the button is disabled", () => {
  const input = parseJobInput({ ...baseJob, whatsappEnabled: false, whatsappNumber: "not a phone" });
  assert.ok(input);
  assert.equal(input.whatsappEnabled, false);
  assert.equal(input.whatsappNumber, "");
});
