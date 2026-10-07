import assert from "node:assert/strict";
import test from "node:test";
import { parseEmployeePatch } from "../lib/recruiting/employee-fields";

test("marking inactive requires a reason and an end date", () => {
  assert.equal(parseEmployeePatch({ status: "inactive" }), null);
  assert.equal(parseEmployeePatch({ status: "inactive", inactiveReason: "pension" }), null);
  const patch = parseEmployeePatch({ status: "inactive", inactiveReason: "resignation", employedTo: "2026-07-31" });
  assert.equal(patch?.status, "INACTIVE");
  assert.equal(patch?.inactiveReason, "RESIGNATION");
  assert.equal(patch?.employedTo?.toISOString().slice(0, 10), "2026-07-31");
});

test("marking active clears the reason and end date", () => {
  const patch = parseEmployeePatch({ status: "active" });
  assert.equal(patch?.status, "ACTIVE");
  assert.equal(patch?.inactiveReason, null);
  assert.equal(patch?.employedTo, null);
});
