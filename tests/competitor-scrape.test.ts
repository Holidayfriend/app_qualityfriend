import assert from "node:assert/strict";
import test from "node:test";
import { searchKeywords, selectHotels } from "../lib/competitors/scrape";

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
});
