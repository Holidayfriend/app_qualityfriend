import assert from "node:assert/strict";
import test from "node:test";
import { parseCompetitorSettings, pickLocation } from "../lib/competitors/location";

test("picks the city location code the way find.php matches a city word", () => {
  const match = pickLocation([
    { location_code: 2380, location_name: "Italy", location_type: "Country" },
    { location_code: 999, location_name: "Near Ritten", location_type: "Neighborhood" },
    { location_code: 9202091, location_name: "Ritten,Trentino-Alto Adige/Sudtirol,Italy", location_type: "Municipality" },
  ], "Ritten");

  assert.deepEqual(match, {
    locationCode: 9202091,
    locationName: "Ritten,Trentino-Alto Adige/Sudtirol,Italy",
  });
});

test("keeps at most 10 must-include competitor names", () => {
  const tooMany = parseCompetitorSettings({
    latitude: "46,5207",
    longitude: 11.4248,
    mustInclude: Array.from({ length: 11 }, (_, index) => `Hotel ${index + 1}`),
  });
  assert.deepEqual(tooMany, { error: "TOO_MANY" });

  const parsed = parseCompetitorSettings({
    latitude: "46.5207",
    longitude: "11,4248",
    mustInclude: ["Wolfsgrubenersee", " wolfsgrubenersee ", "Drei Birken"],
  });
  assert.deepEqual(parsed, {
    latitude: 46.5207,
    longitude: 11.4248,
    mustInclude: ["Wolfsgrubenersee", "Drei Birken"],
  });
});
