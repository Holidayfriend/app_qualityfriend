import assert from "node:assert/strict";
import test from "node:test";
import { cleaningPlan, linenDueToday } from "../lib/housekeeping/daily-plan";

const base = { arrival_date: "2026-09-14", departure_date: "2026-09-21", normal_minutes: 40, express_minutes: 20, departure_minutes: 50, cleaning_weekdays: [] as number[] };

test("daily frequency creates regular cleaning every day", () => {
  assert.deepEqual(cleaningPlan({ ...base, cleaning_frequency: "DAILY" }, "2026-09-15"), { type: "REGULAR", minutes: 40 });
});

test("four-day stay starts express, alternates, and ends with departure cleaning", () => {
  const stay = { ...base, departure_date: "2026-09-17", cleaning_frequency: "EVERY_SECOND_DAY" };
  assert.deepEqual(cleaningPlan(stay, "2026-09-14"), { type: "EXPRESS", minutes: 20 });
  assert.deepEqual(cleaningPlan(stay, "2026-09-15"), { type: "REGULAR", minutes: 40 });
  assert.deepEqual(cleaningPlan(stay, "2026-09-16"), { type: "EXPRESS", minutes: 20 });
  assert.deepEqual(cleaningPlan(stay, "2026-09-17"), { type: "DEPARTURE", minutes: 50 });
});

test("weekly cleaning is regular on stay days 7 and 14, express between them", () => {
  const stay = { ...base, departure_date: "2026-09-29", cleaning_frequency: "WEEKLY" };
  for (let day = 1; day <= 15; day++) {
    const date = `2026-09-${String(13 + day).padStart(2, "0")}`;
    assert.deepEqual(cleaningPlan(stay, date), day % 7 === 0
      ? { type: "REGULAR", minutes: 40 }
      : { type: "EXPRESS", minutes: 20 });
  }
});

test("custom weekdays use regular cleaning only on selected days", () => {
  const schedule = { ...base, cleaning_frequency: "ON_REQUEST", cleaning_weekdays: [1, 4] };
  assert.equal(cleaningPlan(schedule, "2026-09-14").type, "REGULAR");
  assert.equal(cleaningPlan(schedule, "2026-09-15").type, "EXPRESS");
  assert.equal(cleaningPlan(schedule, "2026-09-17").type, "REGULAR");
});

test("departure date uses departure cleaning and minutes", () => {
  assert.deepEqual(cleaningPlan({ ...base, cleaning_frequency: "WEEKLY" }, "2026-09-21"), { type: "DEPARTURE", minutes: 50 });
});

const linen = { arrival_date: "2026-09-14", linen_weekdays: [] as number[] };

test("daily linen is due every occupied day", () => {
  assert.equal(linenDueToday({ ...linen, linen_frequency: "DAILY" }, "2026-09-15"), true);
});

test("every-second-day linen follows arrival then every other day", () => {
  assert.equal(linenDueToday({ ...linen, linen_frequency: "EVERY_SECOND_DAY" }, "2026-09-14"), true);
  assert.equal(linenDueToday({ ...linen, linen_frequency: "EVERY_SECOND_DAY" }, "2026-09-15"), false);
  assert.equal(linenDueToday({ ...linen, linen_frequency: "EVERY_SECOND_DAY" }, "2026-09-16"), true);
});

test("on-request linen is due only on selected weekdays", () => {
  const schedule = { ...linen, linen_frequency: "ON_REQUEST", linen_weekdays: [1, 4] };
  assert.equal(linenDueToday(schedule, "2026-09-14"), true);
  assert.equal(linenDueToday(schedule, "2026-09-15"), false);
  assert.equal(linenDueToday(schedule, "2026-09-17"), true);
});
