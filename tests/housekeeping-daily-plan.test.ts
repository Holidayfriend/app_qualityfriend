import assert from "node:assert/strict";
import test from "node:test";
import { awayUserIds, coverageGaps } from "../lib/housekeeping/away-staff";
import { cleaningPlan, linenDueToday, permanentCleaner, preferenceOnWorkDate } from "../lib/housekeeping/daily-plan";
import { isActiveHousekeeper } from "../lib/housekeeping/active-housekeepers";

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

test("departure day resets the stay preference to Daily", () => {
  assert.equal(preferenceOnWorkDate("NONE", "2026-10-26", "2026-10-26"), "DAILY");
  assert.equal(preferenceOnWorkDate("AS_NEEDED", "2026-10-26", "2026-10-26"), "DAILY");
  assert.equal(preferenceOnWorkDate("DAILY", "2026-10-26", "2026-10-26"), "DAILY");
  assert.equal(preferenceOnWorkDate("NONE", "2026-10-28", "2026-10-26"), "NONE");
  assert.equal(preferenceOnWorkDate("AS_NEEDED", "2026-10-28", "2026-10-26"), "AS_NEEDED");
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

test("permanent work is copied only for someone who is still an active housekeeper", () => {
  const active = new Set(["keeper"]);
  assert.deepEqual(permanentCleaner("keeper", active), { assignedToId: "keeper", origin: "PERMANENT" });
  assert.deepEqual(permanentCleaner("former", active), { assignedToId: null, origin: "PERMANENT" });
  assert.deepEqual(permanentCleaner(null, active), { assignedToId: null, origin: "TODAY_ONLY" });
});

test("vacation or time off leaves today's permanent rooms open", () => {
  const active = new Set(["keeper"]);
  const away = new Set(["keeper"]);
  assert.deepEqual(permanentCleaner("keeper", active, away), { assignedToId: null, origin: "PERMANENT" });
  assert.deepEqual(permanentCleaner("keeper", active, new Set()), { assignedToId: "keeper", origin: "PERMANENT" });
});

test("only a published vacation or time off takes the person off today's rooms", () => {
  assert.equal(awayUserIds([{ userId: "llk", kind: "VACATION" }]).has("llk"), true);
  assert.equal(awayUserIds([{ userId: "llk", kind: "OFF" }]).has("llk"), true);
  assert.equal(awayUserIds([{ userId: "talha", kind: "WORK" }]).has("talha"), false);
  assert.equal(awayUserIds([]).has("llk"), false);
});

test("coverage notice lists only rooms still held by the person who is away", () => {
  const away = new Set(["llk"]);
  const gaps = coverageGaps([
    { number: "233", permanentUserId: "llk", assignedToId: "llk" },
    { number: "23", permanentUserId: "llk", assignedToId: null },
    { number: "3838", permanentUserId: "llk", assignedToId: "llk" },
    { number: "10", permanentUserId: "llk", assignedToId: "talha" },
    { number: "11", permanentUserId: "llk", assignedToId: "llk", completed: true },
    { number: "12", permanentUserId: "talha", assignedToId: "talha" },
  ], away);
  assert.deepEqual(gaps, [{ userId: "llk", rooms: ["23", "233", "3838"] }]);
});

test("housekeeper access follows the role, and inactive or removed users are excluded", () => {
  const employee = { role: "EMPLOYEE", isActive: true, isDeleted: false };
  assert.equal(isActiveHousekeeper(employee, []), true);
  assert.equal(isActiveHousekeeper(employee, [{ moduleKey: "housekeeper", canView: false }]), false);
  assert.equal(isActiveHousekeeper({ ...employee, isActive: false }, []), false);
  assert.equal(isActiveHousekeeper({ ...employee, isDeleted: true }, []), false);
  assert.equal(isActiveHousekeeper({ role: "ADMIN", isActive: true, isDeleted: false }, []), false);
  assert.equal(isActiveHousekeeper({ role: "TEAM_LEAD", isActive: true, isDeleted: false }, []), false);
  assert.equal(isActiveHousekeeper({ role: "TEAM_LEAD", isActive: true, isDeleted: false }, [{ moduleKey: "housekeeper", canView: true }]), true);
});
