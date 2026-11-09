import assert from "node:assert/strict";
import test from "node:test";
import { dashboardBodies, handoverBodies, HANDOVER_LABELS, priorityTasks, taskBodies, type OpsFacts } from "../lib/ai/ops-briefing-text";

const facts: OpsFacts = {
  asOf: "2026-08-19",
  arrivals: 10,
  departures: 6,
  vipArrivals: [{ room: "12", name: "Anna" }, { room: "14", name: "Ben" }],
  expressRooms: [{ number: "45", deadline: "14:00" }, { number: "51", deadline: "14:00" }],
  noServiceRooms: ["50"],
  occupancy: 80,
  absentToday: [],
  absentTomorrow: [{ name: "Zorah", kind: "off" }],
  openTasks: [
    { title: "Hand the room 46 key to the guest", due: "2026-08-19", rank: "today", assignee: "", department: "Reception" },
    { title: "Restock towels in room 48", due: "2026-08-18", rank: "overdue", assignee: "Maria", department: "Housekeeping" },
  ],
  openExtraJobs: [{ title: "Reorder milk", assignee: "Kitchen" }],
};

test("priority tasks put overdue work before work due today", () => {
  const titles = priorityTasks(facts).map((task) => task.title);
  assert.deepEqual(titles, ["Restock towels in room 48", "Hand the room 46 key to the guest"]);
});

test("dashboard briefing uses arrivals, express rooms, and who is off", () => {
  const bodies = dashboardBodies(facts);
  assert.match(bodies.bodyEn, /10 arrivals, including 2 VIP \(12 Anna; 14 Ben\), and 6 departures today\./);
  assert.match(bodies.bodyEn, /Rooms 45 and 51 need express cleaning before 14:00\./);
  assert.match(bodies.bodyEn, /Zorah is off tomorrow\./);
  assert.match(bodies.bodyDe, /10 Ankünfte/);
  assert.match(bodies.bodyDe, /Zimmer 45 und 51/);
  assert.match(bodies.bodyDe, /Zorah hat morgen frei/);
  assert.match(bodies.bodyIt, /10 arrivi/);
  assert.match(bodies.bodyIt, /45 e 51/);
  assert.match(bodies.bodyIt, /Zorah è assente domani/);
});

test("handover briefing keeps focus, open items, and staff note in three languages", () => {
  const bodies = handoverBodies(facts);
  assert.match(bodies.bodyEn, new RegExp(HANDOVER_LABELS.en.focus));
  assert.match(bodies.bodyEn, new RegExp(HANDOVER_LABELS.en.open));
  assert.match(bodies.bodyEn, new RegExp(HANDOVER_LABELS.en.staff));
  assert.match(bodies.bodyEn, /Restock towels in room 48/);
  assert.match(bodies.bodyEn, /Reorder milk/);
  assert.match(bodies.bodyDe, new RegExp(HANDOVER_LABELS.de.focus));
  assert.match(bodies.bodyDe, /Auslastung 80%/);
  assert.match(bodies.bodyIt, new RegExp(HANDOVER_LABELS.it.staff));
  assert.match(bodies.bodyIt, /Occupazione 80%/);
});

test("task briefing names the first priority task and the shift context", () => {
  const bodies = taskBodies(facts);
  assert.match(bodies.bodyEn, /From 2 open tasks, do these first: Restock towels in room 48 \(overdue, Housekeeping, Maria\)/);
  assert.match(bodies.bodyEn, /Rooms 45 and 51 need express cleaning before 14:00/);
  assert.match(bodies.bodyEn, /Zorah is off tomorrow/);
  assert.match(bodies.bodyDe, /Von 2 offenen Aufgaben zuerst: Restock towels in room 48/);
  assert.match(bodies.bodyIt, /Su 2 compiti aperti, prima questi: Restock towels in room 48/);
});

test("an empty day still produces a factual note in three languages", () => {
  const empty: OpsFacts = {
    ...facts,
    arrivals: 0,
    departures: 0,
    vipArrivals: [],
    expressRooms: [],
    noServiceRooms: [],
    absentToday: [],
    absentTomorrow: [],
    openTasks: [],
    openExtraJobs: [],
  };
  const dashboard = dashboardBodies(empty);
  const tasks = taskBodies(empty);
  assert.match(dashboard.bodyEn, /0 arrivals and 0 departures today\./);
  assert.equal(tasks.bodyEn, "No open tasks.");
  assert.equal(tasks.bodyDe, "Keine offenen Aufgaben.");
  assert.equal(tasks.bodyIt, "Nessun compito aperto.");
});
