import assert from "node:assert/strict";
import test from "node:test";
import { classicJobFieldRequired, hasMissingClassicJobFields, type ClassicJobRequiredField } from "../lib/recruiting/job-validation";

const complete = (): Record<ClassicJobRequiredField, boolean> => ({
  title: false,
  dept: false,
  start: false,
  description: false,
  location: false,
  image: false,
  logo: false,
});

test("drafts allow empty description, location, listing image, and logo", () => {
  const missing = complete();
  missing.description = true;
  missing.location = true;
  missing.image = true;
  missing.logo = true;

  assert.equal(hasMissingClassicJobFields(missing, "draft"), false);
  for (const field of ["description", "location", "image", "logo"] as const) {
    assert.equal(classicJobFieldRequired(field, "draft"), false);
  }
});

test("publishing still requires all classic job fields", () => {
  for (const field of ["description", "location", "image", "logo"] as const) {
    const missing = complete();
    missing[field] = true;
    assert.equal(hasMissingClassicJobFields(missing, "active"), true);
  }
});

test("drafts still require title, department, and start date", () => {
  for (const field of ["title", "dept", "start"] as const) {
    const missing = complete();
    missing[field] = true;
    assert.equal(hasMissingClassicJobFields(missing, "draft"), true);
  }
});
