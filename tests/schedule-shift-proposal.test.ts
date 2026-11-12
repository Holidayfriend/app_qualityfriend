import assert from "node:assert/strict";
import test from "node:test";
import { proposeShifts, type ProposalPerson, type ProposalShift } from "../lib/schedule/shift-proposal";

const dates = ["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"];
const max: ProposalPerson = { id: "max", name: "Max Mustermann", departments: ["Reception"], housekeeper: false };
const sabine: ProposalPerson = { id: "sabine", name: "Sabine Schorr", departments: ["Housekeeping"], housekeeper: true };
const llk: ProposalPerson = { id: "llk", name: "LLK Sahi", departments: ["Housekeeping"], housekeeper: true };

function work(userId: string, date: string): ProposalShift {
  return { userId, date, kind: "work", start: "07:00", end: "15:00" };
}

test("a vacation day is never given a shift, and a seventh work day is not proposed", () => {
  const shifts: ProposalShift[] = [
    { userId: "max", date: dates[0], kind: "off", start: "", end: "" },
    ...dates.slice(1).map((date) => work("max", date)),
    ...dates.map((date) => ({ userId: "llk", date, kind: "vac" as const, start: "", end: "" })),
  ];
  const proposals = proposeShifts({
    dates,
    people: [max, sabine, llk],
    shifts,
    rooms: dates.map((date) => ({ date, userId: "llk", rooms: 4 })),
  });
  assert.equal(proposals.some((row) => row.userId === "max"), false);
  assert.equal(proposals.some((row) => row.userId === "llk"), false);
  assert.deepEqual(proposals.map((row) => row.date), dates.slice(0, 6));
  assert.equal(proposals.every((row) => row.userId === "sabine" && row.reason === "cover" && row.coverName === "LLK Sahi"), true);
  assert.equal(proposals[0].start, "07:00");
});

test("empty days copy the person's own hours from this week and stop before seven work days", () => {
  const shifts = dates.slice(0, 5).map((date) => work("max", date));
  const proposals = proposeShifts({ dates, people: [max], shifts, rooms: [] });
  assert.deepEqual(proposals.map((row) => [row.date, row.reason, row.start, row.end]), [
    ["2026-11-14", "sameHours", "07:00", "15:00"],
  ]);
});
