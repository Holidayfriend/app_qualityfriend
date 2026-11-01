import assert from "node:assert/strict";
import test from "node:test";
import { shiftWorkHours } from "../lib/schedule/hours";
import { breakMinutesForSave, conflictingWorkDates, shiftWarnings } from "../lib/schedule/shift-rules";

test("an empty break deducts 30 minutes and an explicit 0 does not", () => {
  assert.equal(breakMinutesForSave("", true), 30);
  assert.equal(breakMinutesForSave(null, true), 30);
  assert.equal(breakMinutesForSave("0", true), 0);
  assert.equal(breakMinutesForSave("45", true), 45);
  assert.equal(breakMinutesForSave("", false), 0);
  assert.equal(shiftWorkHours({ kind: "work", start: "07:00", end: "15:00", breakMins: 30 }), 7.5);
  assert.equal(shiftWorkHours({ kind: "work", start: "07:00", end: "15:00", breakMins: 0 }), 8);
});

test("a 16 hour shift warns and can still be described as two blocks", () => {
  assert.equal(shiftWarnings({ start: "06:00", end: "22:00" })[0]?.code, "long");
  assert.equal(shiftWarnings({ start: "07:00", end: "15:00" }).length, 0);
  assert.equal(shiftWarnings({ start: "07:00", end: "11:00", splitStart: "17:00", splitEnd: "21:00" }).length, 0);
  assert.equal(shiftWarnings({ start: "07:00", end: "15:00", splitStart: "14:00", splitEnd: "18:00" })[0]?.code, "overlap");
  assert.equal(shiftWorkHours({ kind: "work", start: "07:00", end: "11:00", breakMins: 0, splitStart: "17:00", splitEnd: "21:00", splitBreakMins: 0 }), 8);
});

test("sick leave conflicts only with the work shift the planner sees", () => {
  const dates = ["2026-11-02", "2026-11-03", "2026-11-04"];
  assert.deepEqual(conflictingWorkDates(dates, [
    { date: "2026-11-02", kind: "WORK" },
    { date: "2026-11-03", kind: "WORK" },
    { date: "2026-11-03", kind: "OFF", draft: true },
    { date: "2026-11-04", kind: "OFF" },
  ]), ["2026-11-02"]);
});
