import assert from "node:assert/strict";
import test from "node:test";
import { bookedNightsInWindow, isOfferCategory, revenueShares, seasonMonths, sensibleCategoryRate, summarizeStays, yearOverYear } from "../lib/budget/summaries";

test("counts booked room-nights per category inside the 14-day window", () => {
  const stay = (roomNumber: string, categoryId: string | null, arrival: string, departure: string) => ({ roomNumber, categoryId, arrival, departure, accommodation: 0, additional: 0, spa: 0 });
  const dates = ["2026-11-24", "2026-11-25", "2026-11-26"];
  const nights = bookedNightsInWindow([
    stay("101", "a", "2026-11-23", "2026-11-25"),
    stay("101", "a", "2026-11-24", "2026-11-25"),
    stay("102", "a", "2026-11-26", "2026-11-30"),
    stay("201", "b", "2026-12-01", "2026-12-03"),
    stay("301", null, "2026-11-24", "2026-11-26"),
  ], dates);
  // 101 on 24 Nov (two overlapping stays count once) + 102 on 26 Nov.
  assert.equal(nights.get("a"), 2);
  assert.equal(nights.has("b"), false);
});

test("a category rate far from our own price is rejected", () => {
  assert.equal(sensibleCategoryRate(460, 446), 460);
  assert.equal(sensibleCategoryRate(900, 446), null);
  assert.equal(sensibleCategoryRate(100, 446), null);
  assert.equal(sensibleCategoryRate(380, null), 380);
  assert.equal(sensibleCategoryRate(null, 446), null);
});

test("Angebot is the offer category kept out of the budget table", () => {
  assert.equal(isOfferCategory(["Angebot", null, null]), true);
  assert.equal(isOfferCategory(["Double", "Doppelzimmer", "Doppia"]), false);
});

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
