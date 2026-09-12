import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { checkAsaFile } from "../lib/housekeeping/asa-file";

test("ASA preflight requires a name and a real XML file within the configured directory", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "qf-asa-test-"));
  try {
    assert.equal(await checkAsaFile(null, root), "ASA_XML_NAME_REQUIRED");
    assert.equal(await checkAsaFile("  ", root), "ASA_XML_NAME_REQUIRED");
    for (const name of ["../outside", "folder/file", "folder\\file", "https://host/file", "..", "bad\0name"]) {
      assert.equal(await checkAsaFile(name, root), "INVALID_ASA_XML_NAME");
    }
    assert.equal(await checkAsaFile("hotel", root), "ASA_XML_NOT_FOUND");
    await writeFile(path.join(root, "hotel.xml"), "<reservations/>");
    assert.equal(await checkAsaFile("hotel", root), "READY");
    assert.equal(await checkAsaFile(" hotel ", root), "READY");
    assert.equal(await checkAsaFile("hotel.xml", root), "READY");
    await mkdir(path.join(root, "directory.xml"));
    assert.equal(await checkAsaFile("directory", root), "ASA_XML_NOT_FOUND");
    assert.equal(await checkAsaFile("hotel", path.join(root, "missing")), "ASA_XML_NOT_FOUND");
  } finally {
    // Only remove the unique test directory returned by mkdtemp, never the ASA directory.
    if (path.dirname(root) !== path.resolve(tmpdir()) || !path.basename(root).startsWith("qf-asa-test-")) throw new Error("Unexpected test directory");
    await rm(root, { recursive: true, force: true });
  }
});
