import assert from "node:assert/strict";
import test from "node:test";
import { cvReadState, notAssessableSummaries, readableDocumentText } from "../lib/recruiting/cv-read";
import { extractRecruitingDocumentText } from "../lib/recruiting/extract-document";

function textPdf(text: string) {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xrefAt = Buffer.byteLength(body);
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  return Buffer.from(`${body}${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`, "latin1");
}

test("page markers are not treated as CV text", () => {
  assert.equal(readableDocumentText("-- 1 of 1 --"), "");
  assert.equal(cvReadState(false, ""), "missing");
  assert.equal(cvReadState(true, "-- 1 of 1 --"), "unreadable");
  assert.equal(cvReadState(true, "Receptionist with five years hotel experience"), "ready");
});

test("a missing or unreadable CV is not assessable and is never scored 0", () => {
  for (const state of ["missing", "unreadable"] as const) {
    const summary = notAssessableSummaries(state, "Lebenslauf.pdf");
    for (const text of [summary.en, summary.de, summary.it]) {
      assert.match(text, /Not assessable|Nicht bewertbar|Non valutabile/);
      assert.equal(text.includes("0%"), false);
      assert.equal(text.includes("notAFit"), false);
    }
  }
});

test("a text-based PDF CV is extracted", async () => {
  const sentence = "Receptionist with five years hotel experience";
  const text = await extractRecruitingDocumentText(textPdf(sentence), "application/pdf", "Lebenslauf.pdf");
  assert.match(text, /Receptionist with five years hotel experience/);
});

test("a PDF with no text layer stays unreadable", async () => {
  const text = await extractRecruitingDocumentText(textPdf(""), "application/pdf", "blank.pdf");
  assert.equal(cvReadState(true, text), "unreadable");
});
