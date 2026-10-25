import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_CELL, type ShiftCell } from "../lib/schedule/demo-data";
import { buildScheduleCsv, buildScheduleExcelHtml, buildSchedulePrintHtml, cellExportType, formatExportDate, payrollExportEntries, pdfCellLabel, totalsByEmployee, weekExportEntries } from "../lib/schedule/export";
import { shouldCopyWeekShift } from "../lib/schedule/copy-policy";

function cell(patch: Partial<ShiftCell>): ShiftCell {
  return { ...EMPTY_CELL, ...patch };
}

test("export maps work, vacation, off and sick without printing sick on pdf labels", () => {
  assert.equal(cellExportType(cell({ kind: "work", start: "07:00", end: "15:00" })), "shift");
  assert.equal(cellExportType(cell({ kind: "vac", leaveDuration: "full" })), "holiday");
  assert.equal(cellExportType(cell({ kind: "off", leaveCategory: "paid" })), "off");
  assert.equal(cellExportType(cell({ kind: "off", leaveCategory: "paidSick" })), "sick");
  assert.equal(pdfCellLabel(cell({ kind: "off", leaveCategory: "paidSick", leaveDuration: "full" }), "Absent", "–"), "Absent");
  assert.equal(pdfCellLabel(cell({ kind: "work", start: "07:00", end: "15:00" }), "Absent", "–"), "07:00–15:00");
});

test("copy week copies work shifts only", () => {
  assert.equal(shouldCopyWeekShift("WORK"), true);
  assert.equal(shouldCopyWeekShift("OFF"), false);
  assert.equal(shouldCopyWeekShift("VACATION"), false);
});

test("payroll export ignores schedule absences and includes only approved absence requests", () => {
  const people = [{ id: "user-1", name: "Anna Rossi", departmentId: "kitchen", departmentName: "Kitchen" }];
  const entries = payrollExportEntries(people, [
    { userId: "user-1", date: "2026-09-21", kind: "work", start: "07:00", end: "15:00", breakMins: 30, note: "", leaveCategory: "", leaveDuration: "" },
    { userId: "user-1", date: "2026-09-22", kind: "off", start: "", end: "", breakMins: 0, note: "copied sick day", leaveCategory: "paidSick", leaveDuration: "full" },
    { userId: "user-1", date: "2026-09-23", kind: "vac", start: "", end: "", breakMins: 0, note: "copied vacation", leaveCategory: "vacation", leaveDuration: "full" },
  ], [
    { userId: "user-1", start: "2026-09-22", end: "2026-09-22", category: "paidSick", duration: "full", startTime: "", endTime: "", note: "approved sick leave", status: "approved" },
    { userId: "user-1", start: "2026-09-23", end: "2026-09-23", category: "vacation", duration: "full", startTime: "", endTime: "", note: "pending vacation", status: "open" },
    { userId: "user-1", start: "2026-09-24", end: "2026-09-24", category: "paid", duration: "full", startTime: "", endTime: "", note: "rejected leave", status: "rejected" },
  ], "2026-09-21", "2026-09-27");

  assert.deepEqual(entries.map((entry) => [entry.date, entry.type, entry.note]), [
    ["2026-09-21", "shift", ""],
    ["2026-09-22", "sick", "approved sick leave"],
  ]);
});

test("printable PDF week view hides absence reasons", () => {
  const html = buildSchedulePrintHtml([
    { date: "2026-10-19", employee: "Anna Rossi", department: "Kitchen", type: "shift", start: "07:00", end: "15:00", breakMins: 30, hours: 7.5, duration: "", note: "front desk note" },
    { date: "2026-10-20", employee: "Anna Rossi", department: "Kitchen", type: "sick", start: "", end: "", breakMins: 0, hours: 0, duration: "full", note: "private medical reason" },
  ], { title: "Export schedule", week: "Week", absent: "Absent" }, "en", "2026-10-19", "2026-10-25");

  assert.match(html, /07:00–15:00/);
  assert.match(html, />Absent</);
  assert.doesNotMatch(html, /front desk note|private medical reason/);
  assert.match(html, /window\.print/);
});

test("csv lists one row per entry and totals planned hours per employee at the end", () => {
  const entries = weekExportEntries([
    {
      name: "Anna Rossi",
      departmentName: "Kitchen",
      shifts: [
        cell({ kind: "work", start: "07:00", end: "15:00", breakMins: 30, note: "open" }),
        cell({ kind: "off", leaveCategory: "paidSick", leaveDuration: "full", note: "flu" }),
        ...Array.from({ length: 5 }, () => cell({})),
      ],
    },
  ], ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].type, "shift");
  assert.equal(entries[0].hours, 7.5);
  assert.equal(entries[1].type, "sick");
  assert.equal(entries[1].hours, 0);
  const totals = totalsByEmployee(entries);
  assert.deepEqual(totals, [{ employee: "Anna Rossi", department: "Kitchen", hours: 7.5 }]);
  const csv = buildScheduleCsv(entries, totals, {
    headers: ["date", "employee", "department", "type", "start", "end", "break", "net hours", "full/partial day", "note"],
    types: { shift: "shift", off: "off", holiday: "holiday", sick: "sick" },
    durationFull: "Full day",
    durationPartial: "Partial day",
    total: "TOTAL",
  }, "en");
  assert.match(csv, /^﻿date,employee/);
  assert.match(csv, /21\/09\/2026,Anna Rossi,Kitchen,shift,07:00,15:00,30,7\.5,,open/);
  assert.match(csv, /22\/09\/2026,Anna Rossi,Kitchen,sick,,,,0,Full day,flu/);
  assert.match(csv, /TOTAL,Anna Rossi,Kitchen,TOTAL,,,,7\.5,,/);
  assert.equal(formatExportDate("2026-09-21", "en"), "21/09/2026");
  assert.equal(formatExportDate("2026-09-21", "de"), "21.09.2026");
  const xls = buildScheduleExcelHtml(entries, totals, {
    headers: ["date", "employee", "department", "type", "start", "end", "break", "net hours", "full/partial day", "note"],
    types: { shift: "shift", off: "off", holiday: "holiday", sick: "sick" },
    durationFull: "Full day",
    durationPartial: "Partial day",
    total: "TOTAL",
  }, "en");
  assert.match(xls, /21\/09\/2026/);
  assert.match(xls, /#DCFCE7/);
  assert.match(xls, /#FEE2E2/);
});
