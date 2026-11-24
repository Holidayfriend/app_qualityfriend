import assert from "node:assert/strict";
import test from "node:test";
import { matchCategories, parseRates, ratesForDays } from "../lib/revenue/own-rates";

const file = {
  rates: [
    { rate_plan: "TAG_HP", room_category: "WALL", date_from: "2026-11-24", date_to_incl: "2026-12-12", price_occ1: 356.8, price_occ2: 223.0 },
    { rate_plan: "TAG6_HP", room_category: "WALL", date_from: "2026-11-24", date_to_incl: "2026-12-12", price_occ1: 340.8, price_occ2: 213.0 },
    { rate_plan: "TAG_HP", room_category: "EZ", date_from: "2026-11-24", date_to_incl: "2026-12-12", price_occ1: 187.0, price_occ2: null },
    { rate_plan: "TAG_HP", room_category: "WALL", date_from: "2026-12-26", date_to_incl: "2027-01-05", price_occ1: 388.8, price_occ2: 243.0 },
    { rate_plan: "TAG_HP", room_category: "BAD", date_from: "nope", date_to_incl: "2026-12-12", price_occ1: 1, price_occ2: 1 },
  ],
};

test("expands the TAG_HP ranges into one price per day for 14 days", () => {
  const days = ratesForDays(parseRates(file), "2026-12-05");
  const wall = days.filter((day) => day.code === "WALL");
  // 5 Dec .. 12 Dec are covered, 13 Dec .. 18 Dec have no price in the file.
  assert.deepEqual(wall.map((day) => day.date), ["2026-12-05", "2026-12-06", "2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12"]);
  assert.equal(wall[0]?.pricePerPerson2, 223);
  assert.equal(wall[0]?.roomPrice2Adults, 446);
  assert.equal(days.some((day) => day.code === "BAD"), false);
});

test("a single room has no 2-person price", () => {
  const ez = ratesForDays(parseRates(file), "2026-11-24").find((day) => day.code === "EZ");
  assert.equal(ez?.pricePerPerson1, 187);
  assert.equal(ez?.roomPrice2Adults, null);
});

test("matches file codes to the hotel's room categories by name", () => {
  const { matched, unmatched } = matchCategories(["EZ", "JOHAN", "WALL", "ROARE", "KOBEN"], [
    { id: "a", names: ["Einzelzimmer (teils mit traumhaftem Seeblick)"] },
    { id: "b", names: ['Deluxe DZ "JOHANNIS" mit traumhaftem Seeblick'] },
    { id: "c", names: ['Suite "WALLNER" mit traumhaftem Seeblick'] },
    { id: "d", names: ['Suite "ROARER" mit traumhaftem Seeblick'] },
  ]);
  assert.deepEqual([...matched.entries()], [["EZ", "a"], ["JOHAN", "b"], ["WALL", "c"], ["ROARE", "d"]]);
  assert.deepEqual(unmatched, ["KOBEN"]);
});

test("a code that matches two categories is skipped", () => {
  const { matched, unmatched } = matchCategories(["WALL"], [
    { id: "a", names: ['Suite "WALLNER"'] },
    { id: "b", names: ['Suite "WALLNER" plus'] },
  ]);
  assert.equal(matched.size, 0);
  assert.deepEqual(unmatched, ["WALL"]);
});
