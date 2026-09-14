"use client";

import { useEffect, useRef } from "react";
import type { Locale } from "../../lib/i18n/dictionaries";

type SummernoteApi = {
  (options: Record<string, unknown>): unknown;
  (method: "code"): string;
  (method: "code", html: string): unknown;
  (method: "destroy"): unknown;
};

type JQueryLike = (el: HTMLElement) => { summernote: SummernoteApi };

const JQUERY_SRC = "/vendor/jquery/jquery-3.2.1.min.js";
const SUMMERNOTE_CSS = "/vendor/summernote/summernote-lite.css";
const SUMMERNOTE_JS = "/vendor/summernote/summernote-lite.min.js";
const LANG_SRC: Partial<Record<Locale, string>> = {
  de: "/vendor/summernote/lang/summernote-de-DE.min.js",
  it: "/vendor/summernote/lang/summernote-it-IT.min.js",
};

let assetsPromise: Promise<void> | null = null;

function loadCss(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(src: string) {
  const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
  if (existing) {
    return existing.dataset.loaded === "true"
      ? Promise.resolve()
      : new Promise<void>((resolve, reject) => {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
        });
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

function jquery(): JQueryLike | undefined {
  return (window as Window & { jQuery?: JQueryLike }).jQuery;
}

function hasSummernote() {
  const jq = (window as Window & { jQuery?: { fn?: { summernote?: unknown } } }).jQuery;
  return typeof jq?.fn?.summernote === "function";
}

function ensureAssets(locale: Locale) {
  assetsPromise ??= (async () => {
    loadCss(SUMMERNOTE_CSS);
    if (!jquery()) await loadScript(JQUERY_SRC);
    if (!hasSummernote()) await loadScript(SUMMERNOTE_JS);
  })();
  return assetsPromise.then(async () => {
    const lang = LANG_SRC[locale];
    if (lang) await loadScript(lang);
  });
}

export function htmlToPlain(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

export function sanitizeJobHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?(?:iframe|object|embed|link|meta|style)[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, "");
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  locale,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder: string;
  locale: Locale;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    const editor = document.createElement("div");
    holder.replaceChildren(editor);
    targetRef.current = editor;
    let destroyed = false;

    void ensureAssets(locale).then(() => {
      if (destroyed) return;
      const $ = jquery();
      if (!$) return;
      $(editor).summernote({
        height: 350,
        minHeight: null,
        maxHeight: null,
        focus: false,
        placeholder,
        dialogsInBody: true,
        lang: locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-US",
        callbacks: {
          onChange: (contents: string) => onChangeRef.current(contents),
        },
      });
      $(editor).summernote("code", valueRef.current);
    });

    return () => {
      destroyed = true;
      const $ = jquery();
      if ($) {
        try { $(editor).summernote("destroy"); } catch { /* already gone */ }
      }
      targetRef.current = null;
      holder.replaceChildren();
    };
  }, [locale, placeholder]);

  useEffect(() => {
    const target = targetRef.current;
    const $ = jquery();
    if (!target || !$) return;
    try {
      if ($(target).summernote("code") !== value) $(target).summernote("code", value);
    } catch { /* editor not ready */ }
  }, [value]);

  return <div ref={holderRef} className="job-summernote" />;
}
