import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { localeBootScript, localeStorageKey, pickLocale } from "../lib/i18n/locale";

test("a saved account language is used before the browser language", () => {
  assert.deepEqual(pickLocale({ account: "DE", acceptLanguage: "en-GB,en;q=0.9" }), { locale: "de", source: "account" });
  assert.deepEqual(pickLocale({ cookie: "it", account: "DE" }), { locale: "it", source: "cookie" });
  assert.deepEqual(pickLocale({ acceptLanguage: "fr-CH,it;q=0.8,en;q=0.7" }), { locale: "it", source: "browser" });
  assert.deepEqual(pickLocale({ acceptLanguage: "en-GB" }), { locale: "en", source: "browser" });
  assert.deepEqual(pickLocale({ cookie: "sv", account: " ", acceptLanguage: "fr" }), { locale: "en", source: "default" });
});

type BootInput = { lang: string; source: string; cookie?: string; stored?: string | null; guard?: string | null };

function runBoot(input: BootInput) {
  let cookie = input.cookie ?? "";
  const stored = new Map<string, string>();
  if (input.stored) stored.set(localeStorageKey, input.stored);
  const session = new Map<string, string>();
  if (input.guard) session.set("qf-locale-reload", input.guard);
  const result = { replaced: "", stopped: false, visibility: "" };
  const sandbox = {
    document: {
      get cookie() { return cookie; },
      set cookie(value: string) { cookie = value; },
      documentElement: {
        lang: input.lang,
        style: { visibility: "" },
        getAttribute(name: string) { return name === "data-locale-source" ? input.source : null; },
      },
    },
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => { stored.set(key, value); },
    },
    sessionStorage: {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => { session.set(key, value); },
      removeItem: (key: string) => { session.delete(key); },
    },
    location: {
      protocol: "http:",
      href: "http://localhost/dashboard",
      replace(url: string) { result.replaced = url; },
    },
    window: { stop() { result.stopped = true; } },
    decodeURIComponent,
  };
  vm.runInNewContext(localeBootScript(), sandbox);
  result.visibility = sandbox.document.documentElement.style.visibility;
  return { cookie, stored: stored.get(localeStorageKey) ?? null, replaced: result.replaced, stopped: result.stopped, visibility: result.visibility, guard: session.get("qf-locale-reload") ?? null };
}

test("signed-in German accounts keep German when older browser storage says English", () => {
  const result = runBoot({ lang: "de", source: "account", stored: "en" });
  assert.match(result.cookie, /^qualityfriend-locale=de;/);
  assert.equal(result.stored, "de");
  assert.equal(result.replaced, "");
  assert.equal(result.stopped, false);
});

test("a logged-out device locale reloads once instead of painting the browser language", () => {
  const result = runBoot({ lang: "en", source: "browser", stored: "de" });
  assert.match(result.cookie, /^qualityfriend-locale=de;/);
  assert.equal(result.stored, "de");
  assert.equal(result.replaced, "http://localhost/dashboard");
  assert.equal(result.stopped, true);
  assert.equal(result.visibility, "hidden");
  assert.equal(result.guard, "de");
});

test("a repeated locale reload does not loop when the cookie was not accepted", () => {
  const result = runBoot({ lang: "en", source: "default", stored: "de", guard: "de" });
  assert.match(result.cookie, /^qualityfriend-locale=de;/);
  assert.equal(result.replaced, "");
  assert.equal(result.stopped, false);
});

test("an existing locale cookie is mirrored and does not reload", () => {
  const result = runBoot({ lang: "de", source: "cookie", cookie: "qualityfriend-locale=de", stored: "en" });
  assert.equal(result.cookie, "qualityfriend-locale=de");
  assert.equal(result.stored, "de");
  assert.equal(result.replaced, "");
  assert.equal(result.guard, null);
});
