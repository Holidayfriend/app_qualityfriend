import assert from "node:assert/strict";
import test from "node:test";
import { isDueOn, nextDueIso } from "../lib/checklists/recurrence";

const start = new Date("2026-11-16T00:00:00.000Z");

function halfYearly(dayIso: string) {
  return isDueOn({
    dueType: "RECURRING",
    recurrence: "HALF_YEARLY",
    weekdays: [],
    startAt: start,
    endAt: null,
    dueAt: null,
  }, dayIso);
}

test("half-yearly is due on the start day and every six months after it", () => {
  assert.equal(halfYearly("2026-11-16"), true);
  assert.equal(halfYearly("2027-05-16"), true);
  assert.equal(halfYearly("2027-11-16"), true);
  assert.equal(halfYearly("2028-05-16"), true);
});

test("half-yearly skips quarterly and yearly-only dates", () => {
  assert.equal(halfYearly("2027-02-16"), false);
  assert.equal(halfYearly("2027-08-16"), false);
  assert.equal(halfYearly("2027-05-15"), false);
  assert.equal(halfYearly("2026-11-15"), false);
});

test("next half-yearly date is six months after the start", () => {
  const input = {
    dueType: "RECURRING" as const,
    recurrence: "HALF_YEARLY" as const,
    weekdays: [],
    startAt: start,
    endAt: null,
    dueAt: null,
  };
  assert.equal(nextDueIso(input, "2026-11-16"), "2026-11-16");
  assert.equal(nextDueIso(input, "2026-11-17"), "2027-05-16");
  assert.equal(nextDueIso(input, "2027-05-17"), "2027-11-16");
});
