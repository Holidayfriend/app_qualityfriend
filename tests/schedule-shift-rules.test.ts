import assert from "node:assert/strict";
import test from "node:test";
import { hoursForHomeDepartment, shiftWorkHours } from "../lib/schedule/hours";
import { breakMinutesForSave, conflictingWorkDates, sevenDayWorkWarnings, shiftWarnings } from "../lib/schedule/shift-rules";
import { addDaysIso, weekIsoDates } from "../lib/schedule/week";

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

test("statistics count a multi-department person once", () => {
  const shift = { kind: "work" as const, start: "07:00", end: "15:00", breakMins: 30 };
  const totals = hoursForHomeDepartment([
    { departmentId: "kitchen", departmentIds: ["kitchen", "service"], shifts: [shift] },
    { departmentId: "service", departmentIds: ["service"], shifts: [shift] },
    { departmentId: "", departmentIds: [], shifts: [shift] },
  ]);
  assert.equal(totals.get("kitchen"), 7.5);
  assert.equal(totals.get("service"), 7.5);
  assert.equal([...totals.values()].reduce((sum, hours) => sum + hours, 0), 15);
});

test("seven work days in a row warn, including a streak that crosses into this week", () => {
  const week = weekIsoDates("2026-11-09");
  const days = (from: string, count: number) => Array.from({ length: count }, (_, index) => addDaysIso(from, index));
  const max = days("2026-11-09", 7).map((date) => ({ userId: "max", date }));
  const sabine = days("2026-11-09", 6).map((date) => ({ userId: "sabine", date }));
  const llk = days("2026-11-08", 7).map((date) => ({ userId: "llk", date }));
  const earlier = days("2026-11-01", 7).map((date) => ({ userId: "earlier", date }));
  const warnings = sevenDayWorkWarnings([...max, ...sabine, ...llk, ...earlier], week);
  assert.deepEqual(warnings.map((row) => row.userId), ["llk", "max"]);
  assert.equal(warnings.find((row) => row.userId === "llk")?.days, 7);
  assert.equal(warnings.find((row) => row.userId === "max")?.from, "2026-11-09");
  assert.equal(warnings.find((row) => row.userId === "max")?.to, "2026-11-15");
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
