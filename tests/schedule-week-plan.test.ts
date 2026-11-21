import assert from "node:assert/strict";
import test from "node:test";
import { departmentKind, describePlan, planWeek, staffNeeded, type DayMovement, type PlanPerson, type PlanShift } from "../lib/schedule/week-plan";

const dates = ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"];
const template = [{ id: "early", name: "Früh", start: "08:00", end: "16:00", breakMins: 30 }];

function person(id: string, name: string, weeklyDays = 5): PlanPerson {
  return { id, name, departmentId: "hk", departmentName: "Housekeeping", weeklyDays, weeklyHours: null };
}

function movement(date: string, departures: number, occupied = departures): DayMovement {
  return { date, arrivals: 0, departures, stayovers: 0, occupied };
}

const weekMovements = dates.map((date) => movement(date, date === "2026-11-28" ? 12 : 3, date === "2026-11-28" ? 12 : 10));

test("housekeeping headcount follows departures", () => {
  const saturday = movement("2026-11-28", 12);
  const tuesday = movement("2026-11-24", 3);
  assert.equal(staffNeeded("housekeeping", saturday), 4);
  assert.equal(staffNeeded("housekeeping", tuesday), 2);
  assert.equal(staffNeeded("housekeeping", movement("2026-11-24", 0, 0)), 0);
  assert.equal(departmentKind("Küche"), "kitchen");
  assert.equal(departmentKind("Rezeption"), "reception");
});

test("a busy saturday gets four housekeepers and a quiet tuesday only two", () => {
  const people = [person("sabine", "Sabine"), person("rebecca", "Rebecca"), person("zorah", "Zorah"), person("anna", "Anna")];
  const { proposals } = planWeek({
    dates,
    people,
    shifts: [],
    priorShifts: [],
    absences: ["2026-11-25", "2026-11-26", "2026-11-27"].map((date) => ({ userId: "zorah", date, reason: "vacation" as const })),
    movements: weekMovements,
    templates: template,
  });
  const on = (date: string) => proposals.filter((row) => row.date === date && row.departmentId === "hk");
  assert.deepEqual(on("2026-11-28").map((row) => row.name).sort(), ["Anna", "Rebecca", "Sabine", "Zorah"]);
  assert.equal(on("2026-11-24").length, 2);
  assert.equal(proposals.some((row) => row.userId === "zorah" && ["2026-11-25", "2026-11-26", "2026-11-27"].includes(row.date)), false);
  for (const id of ["sabine", "rebecca", "zorah", "anna"]) {
    assert.equal(proposals.filter((row) => row.userId === id).length <= 5, true);
  }
  assert.equal(proposals.every((row) => row.start === "08:00" && row.end === "16:00"), true);
});

test("thursday reports the housekeeper who is on vacation", () => {
  const { proposals, problems } = planWeek({
    dates,
    people: [person("sabine", "Sabine"), person("zorah", "Zorah")],
    shifts: [],
    priorShifts: [],
    absences: ["2026-11-25", "2026-11-26", "2026-11-27"].map((date) => ({ userId: "zorah", date, reason: "vacation" as const })),
    movements: weekMovements,
    templates: template,
  });
  assert.equal(proposals.filter((row) => row.userId === "sabine").length, 5);
  assert.equal(proposals.some((row) => row.userId === "zorah" && row.date === "2026-11-26"), false);
  const thursday = problems.find((problem) => problem.date === "2026-11-26");
  assert.equal(thursday?.needed, 2);
  assert.equal(thursday?.scheduled, 1);
  assert.equal(thursday?.blocked.some((item) => item.name === "Zorah" && item.reason === "vacation"), true);
  const text = describePlan(problems, "de", true);
  assert.match(text.body, /nur 1 von 2 benötigten Mitarbeitern verfügbar \(Zorah im Urlaub\)/);
});

test("vacation, an existing shift, a short rest and a 6-day run are not given another shift", () => {
  const shifts: PlanShift[] = [
    { userId: "anna", date: "2026-11-23", kind: "vac", start: "", end: "", breakMins: 0, leaveCategory: "" },
    { userId: "rebecca", date: "2026-11-24", kind: "work", start: "08:00", end: "16:00", breakMins: 30, leaveCategory: "" },
  ];
  const prior: PlanShift[] = [
    { userId: "sabine", date: "2026-11-22", kind: "work", start: "14:00", end: "23:00", breakMins: 0, leaveCategory: "" },
    ...["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"].map((date) => ({
      userId: "max", date, kind: "work" as const, start: "08:00", end: "16:00", breakMins: 30, leaveCategory: "",
    })),
  ];
  const people = [
    person("anna", "Anna"),
    person("rebecca", "Rebecca"),
    { ...person("sabine", "Sabine"), departmentId: "spa", departmentName: "SeaSpa" },
    { ...person("max", "Max"), departmentId: "kitchen", departmentName: "Küche" },
  ];
  const { proposals } = planWeek({
    dates,
    people,
    shifts,
    priorShifts: prior,
    absences: [{ userId: "anna", date: "2026-11-25", reason: "sick" }],
    movements: dates.map((date) => ({ date, arrivals: 12, departures: 12, stayovers: 20, occupied: 30 })),
    templates: [{ id: "morning", name: "Früh", start: "06:00", end: "14:00", breakMins: 30 }],
  });
  assert.equal(proposals.some((row) => row.userId === "anna" && (row.date === "2026-11-23" || row.date === "2026-11-25")), false);
  assert.equal(proposals.some((row) => row.userId === "rebecca" && row.date === "2026-11-24"), false);
  assert.equal(proposals.some((row) => row.userId === "sabine" && row.date === "2026-11-23"), false);
  assert.equal(proposals.some((row) => row.userId === "max" && row.date === "2026-11-23"), false);
});
