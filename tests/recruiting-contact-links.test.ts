import assert from "node:assert/strict";
import test from "node:test";
import { recruitingMailUrl, recruitingWhatsAppUrl } from "../lib/recruiting/contact-links";

const message = {
  to: "giulia@example.com",
  phone: "+39 340 123 4567",
  subject: "Job offer & next steps",
  text: "Liebe Giulia,\n\nwir freuen uns.",
};

test("builds a mail link with recipient, subject, and message", () => {
  const url = recruitingMailUrl(message);
  assert.equal(url.startsWith("mailto:giulia@example.com?"), true);
  const query = new URL(url).searchParams;
  assert.equal(query.get("subject"), message.subject);
  assert.equal(query.get("body"), message.text);
});

test("builds a WhatsApp link with normalized phone and prefilled message", () => {
  const url = recruitingWhatsAppUrl(message);
  assert.equal(url.startsWith("https://wa.me/393401234567?"), true);
  assert.equal(new URL(url).searchParams.get("text"), `${message.subject}\n\n${message.text}`);
});

test("does not build a WhatsApp link without a phone number", () => {
  assert.equal(recruitingWhatsAppUrl({ ...message, phone: "" }), "");
});
