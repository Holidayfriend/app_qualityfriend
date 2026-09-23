import assert from "node:assert/strict";
import test from "node:test";
import { housekeepingDashboardSummary, occupancyPercent } from "../lib/housekeeping/dashboard-summary";

test("dashboard housekeeping counts occupied-room statuses and lists express and no-service rooms", () => {
  const summary = housekeepingDashboardSummary([
    { number: "45", cleanliness: "DIRTY", noService: false, isExpress: true },
    { number: "51", cleanliness: "DIRTY", noService: false, isExpress: true },
    { number: "12", cleanliness: "CLEANING", noService: false, isExpress: false },
    { number: "20", cleanliness: "CLEAN", noService: false, isExpress: false },
    { number: "21", cleanliness: "INSPECTED", noService: false, isExpress: false },
    { number: "50", cleanliness: "DIRTY", noService: true, isExpress: false },
  ]);
  assert.deepEqual(summary, {
    dirty: 2,
    cleaning: 1,
    ready: 1,
    inspected: 1,
    roomsDue: 5,
    roomsReady: 2,
    roomsOpen: 3,
    expressRooms: ["45", "51"],
    noServiceRooms: ["50"],
  });
});

test("occupancy percent rounds occupied rooms against hotel capacity", () => {
  assert.equal(occupancyPercent(10, 12), 83);
  assert.equal(occupancyPercent(0, 12), 0);
  assert.equal(occupancyPercent(3, 0), 0);
});
