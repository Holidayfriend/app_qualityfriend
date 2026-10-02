import assert from "node:assert/strict";
import test from "node:test";
import { cleaningPlan, linenDueToday } from "../lib/housekeeping/daily-plan";

const base = { arrival_date: "2026-09-14", departure_date: "2026-10-14", normal_minutes: 40, express_minutes: 20, departure_minutes: 50, cleaning_weekdays: [] as number[], linen_weekdays: [] as number[], cleaning_frequency: "EVERY_SECOND_DAY", linen_frequency: "WEEKLY" };
const date = (nights: number) => new Date(Date.UTC(2026, 8, 14 + nights)).toISOString().slice(0, 10);

test("one-, two- and three-night stays follow the client's examples", () => {
  for (const nights of [1, 2, 3]) {
    const stay = { ...base, departure_date: date(nights) };
    assert.deepEqual(cleaningPlan(stay, date(0)), { type: "NONE", minutes: 0 });
    for (let n = 1; n < nights; n++) {
      assert.deepEqual(cleaningPlan(stay, date(n)), n % 2
        ? { type: "EXPRESS", minutes: 20 } : { type: "REGULAR", minutes: 40 });
    }
    assert.deepEqual(cleaningPlan(stay, date(nights)), { type: "DEPARTURE", minutes: 50 });
    assert.equal(linenDueToday({ ...stay, linen_frequency: "DAILY" }, date(nights)), false);
  }
});

test("arrival has no stay cleaning or linen for any frequency", () => {
  for (const frequency of ["DAILY", "EVERY_SECOND_DAY", "WEEKLY", "ON_REQUEST"]) {
    const stay = { ...base, cleaning_frequency: frequency, linen_frequency: frequency, cleaning_weekdays: [1], linen_weekdays: [1] };
    assert.equal(cleaningPlan(stay, date(0)).type, "NONE");
    assert.equal(linenDueToday(stay, date(0)), false);
  }
});

test("daily cleaning and linen begin after the first night", () => {
  const stay = { ...base, cleaning_frequency: "DAILY", linen_frequency: "DAILY" };
  for (let n = 1; n < 20; n++) {
    assert.deepEqual(cleaningPlan(stay, date(n)), { type: "REGULAR", minutes: 40 });
    assert.equal(linenDueToday(stay, date(n)), true);
  }
});

test("every-second-day cleaning and linen use completed nights across month boundaries", () => {
  const stay = { ...base, arrival_date: "2026-09-20", linen_frequency: "EVERY_SECOND_DAY" };
  for (const [day, regular] of [["2026-09-30", true], ["2026-10-01", false], ["2026-10-02", true]] as const) {
    assert.equal(cleaningPlan(stay, day).type, regular ? "REGULAR" : "EXPRESS");
    assert.equal(linenDueToday(stay, day), regular);
  }
});

test("weekly cleaning and linen occur after 7, 14 and 21 completed nights", () => {
  const stay = { ...base, cleaning_frequency: "WEEKLY" };
  for (let n = 1; n <= 22; n++) {
    assert.equal(cleaningPlan(stay, date(n)).type, n % 7 === 0 ? "REGULAR" : "EXPRESS");
    assert.equal(linenDueToday(stay, date(n)), n % 7 === 0);
  }
});

test("selected weekdays still apply after arrival", () => {
  const stay = { ...base, cleaning_frequency: "ON_REQUEST", linen_frequency: "ON_REQUEST", cleaning_weekdays: [1, 4], linen_weekdays: [1, 4] };
  assert.equal(cleaningPlan(stay, "2026-09-15").type, "EXPRESS");
  assert.equal(linenDueToday(stay, "2026-09-15"), false);
  assert.equal(cleaningPlan(stay, "2026-09-17").type, "REGULAR");
  assert.equal(linenDueToday(stay, "2026-09-17"), true);
});

test("departure overrides no-cleaning preference and weekly linen due date", () => {
  const stay = { ...base, departure_date: date(7), guest_cleaning_preference: "NONE" };
  assert.deepEqual(cleaningPlan(stay, date(7)), { type: "DEPARTURE", minutes: 50 });
  assert.equal(linenDueToday(stay, date(7)), false);
  assert.equal(linenDueToday({ ...stay, guest_cleaning_preference: "DAILY" }, date(7)), false);
  assert.equal(cleaningPlan({ ...stay, departure_minutes: null }, date(7)).minutes, 40);
});

test("skipped service never shifts the arrival-based rhythm or catches up", () => {
  assert.equal(cleaningPlan({ ...base, guest_cleaning_preference: "NONE" }, date(1)).type, "NONE");
  assert.equal(cleaningPlan({ ...base, guest_cleaning_preference: "DAILY" }, date(2)).type, "REGULAR");
  assert.equal(cleaningPlan(base, date(3)).type, "EXPRESS");
  assert.equal(linenDueToday({ ...base, guest_cleaning_preference: "NONE" }, date(7)), false);
  assert.equal(linenDueToday(base, date(8)), false);
  assert.equal(linenDueToday(base, date(14)), true);
});

test("outside the stay there is no service", () => {
  for (const day of ["2026-09-13", "2026-10-15"]) {
    assert.equal(cleaningPlan(base, day).type, "NONE");
    assert.equal(linenDueToday(base, day), false);
  }
});
