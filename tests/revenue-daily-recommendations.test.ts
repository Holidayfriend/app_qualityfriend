import assert from "node:assert/strict";
import test from "node:test";
import { averageAmount, fallbackRate, recommendationStatus, splitHotelRates, weekDates } from "../lib/revenue/daily-recommendations";

test("revenue week is today and the next six days", () => {
  assert.deepEqual(weekDates("2026-11-09"), [
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
    "2026-11-15",
  ]);
});

test("own hotel ADR is current and the other ADR values average", () => {
  const rates = splitHotelRates([
    { name: "[OWN HOTEL] Weihrerhof", adr: 380 },
    { name: "Hotel Am Hang", adr: 400 },
    { name: "Post Hotel", adr: 402 },
    { name: "Missing price", adr: null },
  ]);
  assert.equal(rates.current, 380);
  assert.equal(rates.competitorAvg, 401);
});

test("missing prices stay empty and a high occupancy rate moves up", () => {
  assert.equal(fallbackRate(92, null, null), null);
  assert.equal(fallbackRate(92, 380, 401), 410);
  assert.equal(recommendationStatus(380, 420), "URGENT");
  assert.equal(recommendationStatus(300, 312), "ADJUST");
  assert.equal(recommendationStatus(280, 282), "OPTIMAL");
});

test("average ignores empty competitor prices", () => {
  assert.equal(averageAmount([null, undefined, 10]), 10);
  assert.equal(averageAmount([]), null);
});
