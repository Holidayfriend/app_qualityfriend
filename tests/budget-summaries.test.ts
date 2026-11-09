import assert from "node:assert/strict";
import test from "node:test";
import { revenueShares, seasonMonths, summarizeStays, yearOverYear } from "../lib/budget/summaries";

test("rest of season runs from the current month through December", () => {
  assert.deepEqual(seasonMonths("2026-11-09"), [
    { year: 2026, month: 11 },
    { year: 2026, month: 12 },
  ]);
});

test("a stay splits its revenue across the months it covers", () => {
  const facts = summarizeStays([{
    roomNumber: "42",
    categoryId: "category-1",
    arrival: "2026-11-30",
    departure: "2026-12-02",
    accommodation: 300,
    additional: 0,
    spa: 0,
  }]);
  assert.equal(facts.months.get("2026-11")?.nights, 1);
  assert.equal(facts.months.get("2026-12")?.nights, 1);
  assert.equal(facts.months.get("2026-11")?.revenue, 150);
  assert.equal(facts.months.get("2026-12")?.revenue, 150);
  assert.equal(facts.categories.get("2026-11|category-1")?.roomNights.size, 1);
});

test("year over year and revenue shares use the saved totals", () => {
  assert.equal(yearOverYear(110, 100), 10);
  assert.equal(yearOverYear(90, 0), null);
  assert.deepEqual(revenueShares([50, 50]), [50, 50]);
  assert.equal(revenueShares([1, 1, 1]).reduce((sum, share) => sum + share, 0), 100);
});
