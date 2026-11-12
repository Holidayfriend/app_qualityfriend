import assert from "node:assert/strict";
import test from "node:test";
import { lastSevenDayBounds, periodicLastSevenDays } from "../lib/tasks/periodic-week";

const row = (nextDueIso: string, origin: "run" | "original" = "run", extra: Record<string, string> = {}) => ({
  kind: "checklist",
  status: "active",
  completedAt: "",
  origin,
  nextDueIso,
  ...extra,
});

test("the window is today and the six days before it", () => {
  assert.deepEqual(lastSevenDayBounds("2026-11-12"), { start: "2026-11-06", end: "2026-11-13" });
  assert.deepEqual(lastSevenDayBounds("2026-11-01"), { start: "2026-10-26", end: "2026-11-02" });
});

test("periodic checks keep only open runs and originals from the last 7 days", () => {
  const shown = periodicLastSevenDays([
    row("2026-09-28"),
    row("2026-11-05"),
    row("2026-11-06"),
    row("2026-11-09"),
    row("2026-11-12"),
    row("2026-11-13"),
    row("2026-11-15"),
    row("2026-11-12", "original"),
    row("2026-11-12", "run", { completedAt: "2026-11-12T10:00:00.000Z" }),
    row("2026-11-12", "run", { status: "archived" }),
    { kind: "template", status: "active", completedAt: "", origin: "original", nextDueIso: "2026-11-12" },
  ], "2026-11-12");
  assert.deepEqual(shown.map((item) => `${item.origin}:${item.nextDueIso}`), [
    "run:2026-11-06",
    "run:2026-11-09",
    "run:2026-11-12",
    "original:2026-11-12",
  ]);
});
