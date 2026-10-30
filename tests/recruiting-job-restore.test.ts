import assert from "node:assert/strict";
import test from "node:test";
import { statusBeforeArchive } from "../lib/recruiting/job-fields";

test("restore uses the status saved when the job was archived", () => {
  assert.equal(statusBeforeArchive({ before: { status: "draft" }, after: { status: "archived" } }), "draft");
  assert.equal(statusBeforeArchive({ before: { status: "active" }, after: { status: "archived" } }), "active");
  assert.equal(statusBeforeArchive({ before: { status: "archived" }, after: { status: "active" } }), null);
  assert.equal(statusBeforeArchive({ before: { status: "draft" }, after: { status: "active" } }), null);
  assert.equal(statusBeforeArchive(null), null);
});
