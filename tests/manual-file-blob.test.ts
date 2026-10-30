import assert from "node:assert/strict";
import test from "node:test";
import { extractManualBuffer } from "../lib/manuals/extract";

test("manual text is extracted from the stored bytes, not only a local path", async () => {
  const text = await extractManualBuffer(Buffer.from("Early check-in is from 11:00."), "text/plain", "manual.txt");
  assert.match(text, /Early check-in is from 11:00/);
});
