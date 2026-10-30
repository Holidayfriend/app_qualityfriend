import assert from "node:assert/strict";
import { test } from "node:test";
import { noServiceAfterSave } from "../lib/housekeeping/room-flags";

test("leaving no-cleaning requested clears the no-service flag when the checkbox is off", () => {
  assert.equal(noServiceAfterSave({ status: "dirty", checkbox: false, previousPreference: "NONE", nextPreference: "DAILY" }), false);
  assert.equal(noServiceAfterSave({ status: "dirty", checkbox: false, previousPreference: "DAILY", nextPreference: "AS_NEEDED" }), false);
});

test("no-cleaning requested and the no-service status keep the flag on", () => {
  assert.equal(noServiceAfterSave({ status: "dirty", checkbox: false, previousPreference: "DAILY", nextPreference: "NONE" }), true);
  assert.equal(noServiceAfterSave({ status: "noCleaningDesired", checkbox: false, previousPreference: "DAILY", nextPreference: "DAILY" }), true);
});

test("the no-service checkbox still applies when the stay preference is daily", () => {
  assert.equal(noServiceAfterSave({ status: "dirty", checkbox: true, previousPreference: "DAILY", nextPreference: "DAILY" }), true);
  assert.equal(noServiceAfterSave({ status: "clean", checkbox: false, previousPreference: "AS_NEEDED", nextPreference: "AS_NEEDED" }), false);
});
