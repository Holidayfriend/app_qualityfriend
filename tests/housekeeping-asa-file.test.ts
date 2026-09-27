import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAsaFile, readAsaFile } from "../lib/housekeeping/asa-file";

const base = "https://example.test/ASA_ftp/";

test("ASA preflight uses the public ASA folder and the configured filename", async () => {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(`${init?.method || "GET"} ${url}`);
    if (url.endsWith("/hotel.xml")) return new Response(null, { status: 200, headers: { "content-length": "20" } });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  try {
    assert.equal(await checkAsaFile(null, base), "ASA_XML_NAME_REQUIRED");
    assert.equal(await checkAsaFile("  ", base), "ASA_XML_NAME_REQUIRED");
    for (const name of ["../outside", "folder/file", "folder\\file", "https://host/file", "..", "bad\0name"]) {
      assert.equal(await checkAsaFile(name, base), "INVALID_ASA_XML_NAME");
    }
    assert.equal(calls.length, 0);
    assert.equal(await checkAsaFile("missing", base), "ASA_XML_NOT_FOUND");
    assert.equal(await checkAsaFile("hotel", base), "READY");
    assert.equal(await checkAsaFile(" hotel ", base), "READY");
    assert.equal(await checkAsaFile("hotel.xml", base), "READY");
    assert.deepEqual(calls, [
      "HEAD https://example.test/ASA_ftp/missing.xml",
      "HEAD https://example.test/ASA_ftp/hotel.xml",
      "HEAD https://example.test/ASA_ftp/hotel.xml",
      "HEAD https://example.test/ASA_ftp/hotel.xml",
    ]);
  } finally {
    globalThis.fetch = original;
  }
});

test("ASA read downloads the named XML from the public folder", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    assert.equal(String(input), "https://example.test/ASA_ftp/Qualityfriend.xml");
    return new Response(`<?xml version="1.0" encoding="utf-8"?><reservations/>`, { status: 200, headers: { "content-length": "52" } });
  }) as typeof fetch;
  try {
    assert.equal(await readAsaFile("Qualityfriend", base), `<?xml version="1.0" encoding="utf-8"?><reservations/>`);
  } finally {
    globalThis.fetch = original;
  }
});
