import assert from "node:assert/strict";
import test from "node:test";
import { checkInDates, matchStoredCompetitor, searchKeywords, selectHotels } from "../lib/competitors/scrape";

test("builds the three hotel searches from the saved city, address, and name", () => {
  assert.deepEqual(searchKeywords({
    city: "Ritten",
    streetAddress: "Via Costalovara, 22, 39054 Soprabolzano BZ, Italy",
    hotelName: "Weihrerhof",
  }), [
    "hotels in Ritten",
    "hotels in Via Costalovara, 22, 39054 Soprabolzano BZ, Italy",
    "hotels near Weihrerhof Ritten",
  ]);
});

test("keeps hotels inside 6 km and checks must-include names", () => {
  const result = selectHotels([
    {
      date: "2026-11-19",
      items: [
        { title: "Hotel Weihrerhof", hotel_identifier: "own", location: { latitude: 46.5207, longitude: 11.4248 }, prices: { price: 180 }, reviews: { value: 4.9, votes_count: 10 } },
        { title: "Hotel Wolfsgrubenersee", hotel_identifier: "wolf", location: { latitude: 46.522, longitude: 11.426 }, prices: { price: 210 } },
        { title: "Far Hotel", hotel_identifier: "far", location: { latitude: 47.2, longitude: 11.4 }, prices: { price: 90 } },
      ],
    },
    {
      date: "2026-12-03",
      items: [
        { title: "Hotel Weihrerhof", hotel_identifier: "own", prices: { price: 240 } },
      ],
    },
  ], { latitude: 46.5207, longitude: 11.4248 }, "Weihrerhof", ["Wolfsgrubenersee", "Missing Hotel"]);

  assert.deepEqual(result.mustHave, [
    { name: "Wolfsgrubenersee", found: true },
    { name: "Missing Hotel", found: false },
  ]);
  assert.equal(result.hotels.some((hotel) => hotel.title === "Far Hotel"), false);
  assert.equal(result.hotels[0]?.title, "[OWN HOTEL] Hotel Weihrerhof");
  assert.equal(result.hotels[0]?.minPrice, 180);
  assert.equal(result.hotels[0]?.maxPrice, 240);
  assert.equal(result.hotels[0]?.adr, 210);
});

test("scrape keeps only the hotels typed under Must include", () => {
  const result = selectHotels([
    {
      date: "2026-11-19",
      items: [
        { title: "Hotel Weihrerhof", hotel_identifier: "own", location: { latitude: 46.5207, longitude: 11.4248 }, prices: { price: 180 } },
        { title: "Hotel Wolfsgrubenersee", hotel_identifier: "wolf", location: { latitude: 46.522, longitude: 11.426 }, prices: { price: 210 } },
        { title: "Hotel Other", hotel_identifier: "other", location: { latitude: 46.523, longitude: 11.427 }, prices: { price: 120 } },
      ],
    },
  ], { latitude: 46.5207, longitude: 11.4248 }, "Weihrerhof", ["wolfsgrubenersee"]);

  assert.deepEqual(result.selected.map((hotel) => hotel.key), ["wolf"]);
  assert.equal(selectHotels([], { latitude: 0, longitude: 0 }, "X", []).selected.length, 0);
});

test("uses today's quoted min and max and sets ADR to their average", () => {
  const result = selectHotels([
    {
      date: "2026-11-20",
      items: [
        { title: "Hotel Am Hang", hotel_identifier: "hang", location: { latitude: 46.521, longitude: 11.425 }, prices: { price: 160, price_without_discount: 220 } },
      ],
    },
    {
      date: "2026-12-14",
      items: [
        { title: "Hotel Am Hang", hotel_identifier: "hang", prices: { price: 400 } },
      ],
    },
  ], { latitude: 46.5207, longitude: 11.4248 }, "Weihrerhof", [], 6, "2026-11-20");

  assert.equal(result.hotels[0]?.minPrice, 160);
  assert.equal(result.hotels[0]?.maxPrice, 220);
  assert.equal(result.hotels[0]?.adr, 190);
});

test("price updates match a saved competitor and ignore a new one", () => {
  const found = [
    { key: "hang", title: "Hotel Am Hang" },
    { key: "new-hotel", title: "Hotel Neu" },
  ];
  assert.equal(matchStoredCompetitor({ externalKey: "hang", name: "Hotel Am Hang" }, found)?.key, "hang");
  assert.equal(matchStoredCompetitor({ externalKey: "manual-1", name: "[OWN HOTEL] Hotel Weihrerhof" }, [{ key: "own", title: "[OWN HOTEL] Hotel Weihrerhof" }])?.key, "own");
  assert.equal(matchStoredCompetitor({ externalKey: "old", name: "Hotel Alt" }, found), null);
});

test("searches the next 14 days, one night each", () => {
  const dates = checkInDates(new Date("2026-11-24T12:00:00Z"));
  assert.equal(dates.length, 14);
  assert.deepEqual([dates[0], dates[1], dates[13]].map((d) => [d.checkIn, d.checkOut]), [
    ["2026-11-24", "2026-11-25"],
    ["2026-11-25", "2026-11-26"],
    ["2026-12-07", "2026-12-08"],
  ]);
});

test("keeps min, max and ADR for every date", () => {
  const origin = { latitude: 46.5207, longitude: 11.4248 };
  const result = selectHotels([
    { date: "2026-11-24", items: [{ title: "Hotel Am Hang", hotel_identifier: "hang", location: { latitude: 46.521, longitude: 11.425 }, prices: { price: 160, price_without_discount: 220 } }] },
    { date: "2026-11-25", items: [{ title: "Hotel Am Hang", hotel_identifier: "hang", prices: { price: 200 } }] },
  ], origin, "Weihrerhof", ["Am Hang"], 6, "2026-11-24");
  assert.deepEqual(result.selected[0]?.daily, [
    { date: "2026-11-24", min: 160, max: 220, adr: 190 },
    { date: "2026-11-25", min: 200, max: 200, adr: 200 },
  ]);
});

test("check-in dates start with today", () => {
  const dates = checkInDates(new Date("2026-11-20T12:00:00Z"));
  assert.equal(dates[0]?.checkIn, "2026-11-20");
  assert.equal(dates[0]?.checkOut, "2026-11-21");
});
