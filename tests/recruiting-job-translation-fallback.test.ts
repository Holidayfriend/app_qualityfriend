import assert from "node:assert/strict";
import test from "node:test";
import { jobTranslationFallbackPatch } from "../lib/recruiting/job-translations";

const fields = {
  title: "Receptionist",
  notes: "Flexible hours",
  description: "<p>Welcome guests.</p>",
};

test("update fallback changes only the edited language", () => {
  assert.deepEqual(jobTranslationFallbackPatch("de", fields), {
    titleDe: fields.title,
    notesDe: fields.notes,
    descriptionDe: fields.description,
  });
});

test("update fallback treats an unsupported locale as English", () => {
  assert.deepEqual(jobTranslationFallbackPatch("fr", fields), {
    title: fields.title,
    notes: fields.notes,
    description: fields.description,
  });
});

test("create fallback fills all required language columns with source content", () => {
  assert.deepEqual(jobTranslationFallbackPatch("de", fields, true), {
    title: fields.title,
    titleDe: fields.title,
    titleIt: fields.title,
    notes: fields.notes,
    notesDe: fields.notes,
    notesIt: fields.notes,
    description: fields.description,
    descriptionDe: fields.description,
    descriptionIt: fields.description,
  });
});
