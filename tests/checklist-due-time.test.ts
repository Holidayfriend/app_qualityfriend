import assert from "node:assert/strict";
import test from "node:test";
import { checklistDueTime, dueWithTime, moveIndex } from "../lib/checklists/due-time";

test("checklist due time keeps a clock and drops anything else", () => {
  assert.equal(checklistDueTime("09:30"), "09:30");
  assert.equal(checklistDueTime("09:30:00"), "09:30");
  assert.equal(checklistDueTime(" 23:59 "), "23:59");
  assert.equal(checklistDueTime(""), "");
  assert.equal(checklistDueTime("9:30"), "");
  assert.equal(checklistDueTime("24:00"), "");
});

test("due label joins the date and the time", () => {
  assert.equal(dueWithTime("1 Nov 2026", "14:00"), "1 Nov 2026 14:00");
  assert.equal(dueWithTime("1 Nov 2026", ""), "1 Nov 2026");
  assert.equal(dueWithTime("", ""), "–");
});

test("moveIndex reorders a list without dropping rows", () => {
  assert.deepEqual(moveIndex(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
  assert.deepEqual(moveIndex(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(moveIndex(["a", "b"], 0, 0), ["a", "b"]);
  assert.deepEqual(moveIndex(["a"], 0, 3), ["a"]);
});
