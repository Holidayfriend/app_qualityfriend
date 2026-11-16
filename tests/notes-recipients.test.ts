import assert from "node:assert/strict";
import test from "node:test";
import { uniqueRecipientIds } from "../lib/notes/recipients";

test("a person in the department and also named is notified once", () => {
  const ids = uniqueRecipientIds(
    [
      ["dept-member", "named-and-in-dept"],
      ["named-and-in-dept", "outside-user"],
    ],
    "author",
  );
  assert.deepEqual(ids, ["dept-member", "named-and-in-dept", "outside-user"]);
});

test("the author is left out even when they belong to the department", () => {
  assert.deepEqual(uniqueRecipientIds([["author", "colleague"], ["author"]], "author"), ["colleague"]);
});
