import assert from "node:assert/strict";
import test from "node:test";
import { materializeNoteImages, stripBrokenDataImages } from "../lib/notes/inline-images";

const png = Buffer.from("png-bytes");

test("a picture embedded in the note is stored as a link", async () => {
  const html = `<p>Hello</p><img src="data:image/png;base64,${png.toString("base64")}" alt="">`;
  const saved: Buffer[] = [];
  const next = await materializeNoteImages(html, async (bytes) => {
    saved.push(bytes);
    return "/api/notes/images/file.png";
  });
  assert.equal(saved.length, 1);
  assert.equal(saved[0]?.toString(), "png-bytes");
  assert.equal(next, `<p>Hello</p><img src="/api/notes/images/file.png" alt="">`);
});

test("a cut-off picture tag is removed instead of shown as text", () => {
  const html = `<p>Keep</p><img src="data:image/png;base64,${"A".repeat(50)}`;
  assert.equal(stripBrokenDataImages(html), "<p>Keep</p>");
});
