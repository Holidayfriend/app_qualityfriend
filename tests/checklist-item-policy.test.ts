import assert from "node:assert/strict";
import test from "node:test";
import { checklistCompletionError, checklistItemError, isChecklistItemState } from "../lib/checklists/item-policy";

test("accepts the three supported checklist item states", () => {
  assert.equal(isChecklistItemState("open"), true);
  assert.equal(isChecklistItemState("done"), true);
  assert.equal(isChecklistItemState("exception"), true);
  assert.equal(isChecklistItemState("blocked"), false);
});

test("requires an explanation for an exception", () => {
  assert.equal(checklistItemError({ state: "exception", comment: "" }), "EXCEPTION_COMMENT_REQUIRED");
  assert.equal(checklistItemError({ state: "exception", comment: "Broken seal" }), null);
  assert.equal(checklistItemError({ state: "done", comment: "" }), null);
});

test("prevents completion while an item is open", () => {
  assert.equal(checklistCompletionError([
    { state: "done", comment: "" },
    { state: "open", comment: "" },
  ]), "OPEN_ITEMS");
});

test("allows completion when every item is done or has a documented exception", () => {
  assert.equal(checklistCompletionError([
    { state: "done", comment: "" },
    { state: "exception", comment: "Replacement ordered" },
  ]), null);
});
