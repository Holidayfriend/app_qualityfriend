import assert from "node:assert/strict";
import test from "node:test";
import { jobSaveErrorKey, jobTranslationFailureReason } from "../lib/recruiting/job-save-error";

test("translation and server failures never blame required fields", () => {
  assert.equal(jobSaveErrorKey(502, "TRANSLATION_FAILED"), "jobTranslationFailed");
  assert.equal(jobSaveErrorKey(500, undefined), "jobServerFailed");
  assert.equal(jobSaveErrorKey(400, "INVALID_DEPARTMENT"), "jobDepartmentInvalid");
  assert.equal(jobSaveErrorKey(403, "FORBIDDEN"), "jobAccessDenied");
});

test("translation reasons are safe and specific", () => {
  const error = new Error("private provider details");
  error.name = "HotelAiNotConfiguredError";
  assert.equal(jobTranslationFailureReason(error), "AI_NOT_CONFIGURED");
  assert.equal(jobSaveErrorKey(502, "TRANSLATION_FAILED", "AI_NOT_CONFIGURED"), "jobAiNotConfigured");
  error.name = "TimeoutError";
  assert.equal(jobTranslationFailureReason(error), "TIMEOUT");
  assert.equal(jobTranslationFailureReason(new SyntaxError("private response")), "INVALID_AI_RESPONSE");
  assert.equal(jobTranslationFailureReason(new Error("private provider details")), "AI_REQUEST_FAILED");
});
