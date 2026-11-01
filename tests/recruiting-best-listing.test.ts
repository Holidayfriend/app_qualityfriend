import assert from "node:assert/strict";
import test from "node:test";
import { bestListingJob } from "../lib/recruiting/best-listing";

test("best listing ignores postings with no clicks", () => {
  const best = bestListingJob([
    { title: "Empty", clicks: 0, conv: "–" },
    { title: "Quiet", clicks: 20, conv: "5.00%" },
    { title: "Busy", clicks: 100, conv: "2.00%" },
  ]);
  assert.equal(best?.title, "Quiet");
});

test("best listing is empty when every posting has no clicks", () => {
  assert.equal(bestListingJob([{ title: "Empty", clicks: 0, conv: "–" }]), undefined);
});
