import assert from "node:assert/strict";
import test from "node:test";
import { EMPTY_CELL, type ShiftCell } from "../lib/schedule/demo-data";
import { buildScheduleCsv, buildScheduleExcelHtml, cellExportType, formatExportDate, pdfCellLabel, totalsByEmployee, weekExportEntries } from "../lib/schedule/export";

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
