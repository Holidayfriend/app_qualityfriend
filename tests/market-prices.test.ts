import assert from "node:assert/strict";
import test from "node:test";
import { competitorsOnDate, dailyFromMentions, mean, weightedPrice } from "../lib/revenue/market-prices";

const dates = new Set(["2026-11-24", "2026-11-25", "2026-11-26"]);

test("reads a competitor's ADR per date from the saved prices", () => {
  const days = dailyFromMentions([
    { date: "2026-11-24", price: 160, minPrice: 160, maxPrice: 220, adr: 190 },
    { date: "2026-11-25", price: 200 },
    { date: "2026-12-30", price: 999 },
    { date: "2026-11-26", price: 0 },
    "junk",
  ], dates);
  assert.deepEqual([...days.entries()], [["2026-11-24", 190], ["2026-11-25", 200]]);
  assert.equal(dailyFromMentions(null, dates).size, 0);
});

test("competitor average, lowest and highest for one date", () => {
  const competitors = [
    { days: new Map([["2026-11-24", 190], ["2026-11-25", 200]]) },
    { days: new Map([["2026-11-24", 250]]) },
    { days: new Map<string, number>() },
  ];
  assert.deepEqual(competitorsOnDate(competitors, "2026-11-24"), { avg: 220, low: 190, high: 250, count: 2 });
  assert.deepEqual(competitorsOnDate(competitors, "2026-11-26"), { avg: null, low: null, high: null, count: 0 });
});

test("our price is the room-count weighted average of the categories that have a price", () => {
  assert.equal(weightedPrice([
    { price: 446, weight: 2 },
    { price: 374, weight: 6 },
    { price: null, weight: 2 },
  ]), 392);
  assert.equal(weightedPrice([{ price: null, weight: 2 }]), null);
  assert.equal(mean([100, null, 200]), 150);
});
