"use client";

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import type { RecruitingMessages } from "../../lib/i18n/recruiting-messages";
import type { Locale } from "../../lib/i18n/dictionaries";
import { LanguageSwitcher } from "../i18n/language-switcher";
import {
  DEFAULT_FOOTER_URL, QUIZ_IMAGE_PLACEHOLDER, QUIZ_LOGO, QUIZ_VOICE_AVATAR, QUIZ_VOICE_SAMPLE,
  type QuizChoice, type QuizElement, type QuizFooter, type QuizPage,
} from "./quiz-builder";

type T = RecruitingMessages;
type Answer = {
  pageId: string;
  pageName: string;
  elementId: string;
  type: string;
  prompt: string;
  value: string;
  labels: string[];
};

function promptFor(element: QuizElement, page: QuizPage) {
  const texts = page.elements.filter((item) => item.type === "text" || item.type === "text_header" || item.type === "text_small").map((item) => item.text).filter(Boolean);
  if (element.type === "single" || element.type === "multi") return texts.at(-1) || element.options.map((item) => item.label).join(" / ");
  if (element.type === "area") return texts.at(-1) || element.placeholder;
  if (element.type === "file") return texts.at(-1) || element.text;
  if (element.type === "form") return page.name;
  return element.text || page.name;
}

function upsert(list: Answer[], next: Answer) {
  return [...list.filter((item) => item.elementId !== next.elementId), next];
}

function textStyle(element: QuizElement): CSSProperties {
  return {
    color: element.color || undefined,
    fontWeight: element.bold ? 700 : 400,
    fontStyle: element.italic ? "italic" : undefined,
    textDecoration: element.underline ? "underline" : undefined,
  };
}

function ctaStyle(element: QuizElement): CSSProperties {
  return {
    ...textStyle(element),
    background: element.btnColor || undefined,
    border: element.borderWidth ? `${element.borderWidth}px solid ${element.borderColor || "#1c2233"}` : undefined,
    borderRadius: element.radius,
  };
}

export function QuizApplyPage({
  t, slug, locale, pages, footer, cvRequired = false, langs, onLocaleChange,
}: {
  t: T;
  slug: string;
  locale: string;
  pages: QuizPage[];
  footer: QuizFooter;
  cvRequired?: boolean;
  langs?: Locale[];
  onLocaleChange?: (locale: Locale) => void;
}) {
  const startId = pages[0]?.id ?? "";
  const [pageId, setPageId] = useState(startId);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [areas, setAreas] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, string>>({});
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const page = useMemo(() => pages.find((item) => item.id === pageId) ?? pages[0], [pages, pageId]);

  useEffect(() => {
    if (pages.length && !pages.some((item) => item.id === pageId)) setPageId(pages[0].id);
  }, [pages, pageId]);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pageId]);

  function go(nextId: string) {
    setError("");
    if (nextId && pages.some((item) => item.id === nextId)) {
      setPageId(nextId);
      return;
    }
    const index = pages.findIndex((item) => item.id === pageId);
    const fallback = pages[index + 1];
    if (fallback) setPageId(fallback.id);
  }

  function choose(element: QuizElement, option: QuizChoice) {
    const selected = element.type === "multi"
      ? (picked[element.id]?.includes(option.id) ? (picked[element.id] ?? []).filter((id) => id !== option.id) : [...(picked[element.id] ?? []), option.id])
      : [option.id];
    setPicked({ ...picked, [element.id]: selected });
    const labels = element.options.filter((item) => selected.includes(item.id)).map((item) => item.label);
    setAnswers(upsert(answers, {
      pageId: page.id, pageName: page.name, elementId: element.id, type: element.type,
      prompt: promptFor(element, page), value: labels.join(", "), labels,
    }));
    if (element.type === "single") go(option.nextPageId);
  }

  async function submitForm(event: FormEvent, element: QuizElement) {
    event.preventDefault();
    setShowErrors(true);
    const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
    const cvName = Object.values(files).filter(Boolean)[0] ?? "";
    if (!firstName.trim() || !lastName.trim() || !emailOk || (cvRequired && !cvName)) {
      setError("");
      return;
    }
    const formAnswer: Answer = {
      pageId: page.id, pageName: page.name, elementId: element.id, type: "form",
      prompt: promptFor(element, page),
      value: `${firstName.trim()} ${lastName.trim()} · ${email.trim()} · ${phone.trim()}`,
      labels: [firstName.trim(), lastName.trim(), email.trim(), phone.trim()],
    };
    const payload = [...answers, formAnswer];
    setBusy(true);
    setError("");
    const res = await fetch(`/api/apply/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale, firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim(),
        cvFileName: cvName,
        answers: payload,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(t.saveFailed);
      return;
    }
    go(element.nextPageId || "thanks");
  }

  function render(element: QuizElement) {
    const wrap: CSSProperties = {
      textAlign: element.align,
      background: element.bgColor || undefined,
      padding: element.bgColor ? "12px 14px" : undefined,
      borderRadius: element.bgColor ? 8 : undefined,
    };
    if (element.type === "columns") {
      return (
        <div className="quiz-cols" style={{ gridTemplateColumns: `repeat(${Math.max(element.columns.length, 1)}, minmax(0, 1fr))` }}>
          {(element.columns.length ? element.columns : [[], []]).map((column, col) =>
            <div key={`${element.id}-${col}`} className="quiz-col">{column.map((child) => <div key={child.id}>{render(child)}</div>)}</div>)}
        </div>
      );
    }
    if (element.type === "text" || element.type === "text_small" || element.type === "text_header") {
      return <div className="quiz-copy" style={{ ...wrap, ...textStyle(element), fontSize: element.fontSize, whiteSpace: "pre-wrap" }}>{element.text}</div>;
    }
    if (element.type === "icons") return <div style={{ ...wrap, fontSize: element.fontSize, lineHeight: 1 }}>{element.icon}</div>;
    if (element.type === "button") {
      return <div style={wrap}><button type="button" className="quiz-cta" style={ctaStyle(element)} onClick={() => go(element.nextPageId)}>{element.text}</button></div>;
    }
    if (element.type === "image") {
      return (
        <div style={wrap}>
          <img src={element.src || QUIZ_IMAGE_PLACEHOLDER} alt="" className="quiz-img" style={{ display: "inline-block", width: `${element.width}%`, maxWidth: "100%", margin: "8px 0", borderRadius: element.radius, border: element.borderWidth ? `${element.borderWidth}px solid ${element.borderColor || "#1c2233"}` : undefined }} />
        </div>
      );
    }
    if (element.type === "audio") {
      return (
        <div style={wrap}>
          <div className="quiz-voice" style={{ alignItems: element.align === "left" ? "flex-start" : element.align === "right" ? "flex-end" : "center" }}>
            <img src={element.avatarSrc || QUIZ_VOICE_AVATAR} alt="" className="quiz-avatar" />
            <audio controls src={element.src || QUIZ_VOICE_SAMPLE} />
          </div>
        </div>
      );
    }
    if (element.type === "quote") {
      return (
        <div className="quiz-quote" style={{ ...wrap, textAlign: undefined }}>
          <div className="quiz-voice">
            <img src={element.avatarSrc || QUIZ_VOICE_AVATAR} alt="" className="quiz-avatar" />
            <audio controls src={element.src || QUIZ_VOICE_SAMPLE} />
          </div>
          <div>
            <div style={{ fontSize: 45, textAlign: "left", lineHeight: 1, color: element.color || undefined }}>❝</div>
            <div className="quiz-copy" style={{ ...textStyle(element), fontSize: 14, whiteSpace: "pre-wrap" }}>{element.text}</div>
          </div>
        </div>
      );
    }
    if (element.type === "spacers") {
      return <div className="quiz-spacer" style={{ height: element.height, background: "none", display: "flex", alignItems: "center", margin: 0 }}>{element.line ? <div style={{ height: 1, width: "100%", background: "var(--border)" }} /> : null}</div>;
    }
    if (element.type === "video") {
      const src = element.src.includes("player.vimeo.com") || element.src.includes("youtube") ? element.src : `https://www.youtube.com/embed/${element.src}`;
      return <div style={wrap}><div className="quiz-video"><iframe title="video" src={src} allow="fullscreen" /></div></div>;
    }
    if (element.type === "single" || element.type === "multi") {
      const selected = picked[element.id] ?? [];
      return (
        <div className="quiz-choices" style={{ ...wrap, textAlign: undefined }}>
          {element.options.map((option) =>
            <button key={option.id} type="button" className={`quiz-choice ${selected.includes(option.id) ? "on" : ""}`} style={{ ...textStyle(element), background: element.btnColor || undefined }} onClick={() => choose(element, option)}>
              {element.type === "multi" ? <input type="checkbox" checked={selected.includes(option.id)} readOnly /> : <span className="quiz-choice-arrow">›</span>}
              <span style={{ flex: 1, textAlign: "left", fontSize: 16 }}>{option.label}</span>
              <span className="quiz-choice-icon">{option.icon}</span>
            </button>)}
        </div>
      );
    }
    if (element.type === "area") {
      return (
        <div style={wrap}>
          <textarea
            className="quiz-area"
            rows={6}
            placeholder={element.placeholder}
            value={areas[element.id] ?? ""}
            onChange={(event) => {
              setAreas({ ...areas, [element.id]: event.target.value });
              setAnswers(upsert(answers, { pageId: page.id, pageName: page.name, elementId: element.id, type: "area", prompt: promptFor(element, page), value: event.target.value, labels: [event.target.value] }));
            }}
          />
        </div>
      );
    }
    if (element.type === "file") {
      const missingCv = cvRequired && !files[element.id];
      return (
        <div style={{ ...wrap, textAlign: "center" }}>
          <label className={`quiz-file${showErrors && missingCv ? " is-invalid" : ""}`}>
            <div className="quiz-file-inner">
              <div className="quiz-file-ic">⬆</div>
              <div>{files[element.id] || t.clickOrDropFile}</div>
            </div>
            <input type="file" accept=".pdf,.doc,.docx,application/pdf" hidden onChange={(event) => {
              const name = event.target.files?.[0]?.name ?? "";
              setFiles({ ...files, [element.id]: name });
              setAnswers(upsert(answers, { pageId: page.id, pageName: page.name, elementId: element.id, type: "file", prompt: promptFor(element, page), value: name, labels: name ? [name] : [] }));
            }} />
          </label>
          <button type="button" className="quiz-cta" style={ctaStyle(element)} onClick={() => {
            if (cvRequired && !files[element.id]) { setShowErrors(true); return; }
            go(element.nextPageId);
          }}>{element.text || t.send}</button>
          {cvRequired ? null : <div className="quiz-skip" onClick={() => go(element.nextPageId)}>{t.skip}</div>}
        </div>
      );
    }
    return (
      <form style={wrap} className="quiz-form" noValidate onSubmit={(event) => void submitForm(event, element)}>
        <input className={`quiz-form-input${showErrors && !firstName.trim() ? " is-invalid" : ""}`} placeholder={t.firstNamePh} value={firstName} onChange={(event) => setFirstName(event.target.value)} />
        <input className={`quiz-form-input${showErrors && !lastName.trim() ? " is-invalid" : ""}`} placeholder={t.lastNamePh} value={lastName} onChange={(event) => setLastName(event.target.value)} />
        <input className={`quiz-form-input${showErrors && !/^\S+@\S+\.\S+$/.test(email.trim()) ? " is-invalid" : ""}`} type="email" placeholder={t.email} value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="quiz-form-input" type="tel" placeholder={t.phone} value={phone} onChange={(event) => setPhone(event.target.value)} />
        <label className="quiz-copy" style={{ fontSize: 14 }}><input type="checkbox" required /> {t.privacyAgree}</label>
        {error ? <p className="job-apply-error">{error}</p> : null}
        <button type="submit" className="quiz-cta" style={ctaStyle(element)} disabled={busy}>{element.text || t.formSubmit}</button>
      </form>
    );
  }

  if (!page) return <p className="job-apply-missing">Job not found.</p>;

  return (
    <div className="job-apply job-apply-quiz qf-dashboard">
      <header className="job-apply-bar">
        <span />
        {langs && langs.length > 1 ? <LanguageSwitcher locales={langs} locale={locale as Locale} onLocaleChange={onLocaleChange} /> : null}
      </header>
      <main className="job-apply-quiz-main">
        <div className="quiz-phone quiz-funnel">
          <div className="quiz-logo" style={{ justifyContent: page.logo?.align === "left" ? "flex-start" : page.logo?.align === "right" ? "flex-end" : "center" }}>
            <img src={page.logo?.src || QUIZ_LOGO} alt="" style={{ width: `${page.logo?.width || 28}%`, maxWidth: "100%" }} />
          </div>
          <div className="quiz-canvas">
            {page.elements.map((element) => <div key={element.id} className="quiz-apply-item">{render(element)}</div>)}
          </div>
          <div className="quiz-funnel-footer">
            <div>
              <a href={footer.impressumUrl.trim() || DEFAULT_FOOTER_URL} target="_blank" rel="noreferrer">{t.impressum}</a>
              {" | "}
              <a href={footer.privacyUrl.trim() || DEFAULT_FOOTER_URL} target="_blank" rel="noreferrer">{t.dataPolicy}</a>
            </div>
            <div><a href={DEFAULT_FOOTER_URL} target="_blank" rel="noreferrer">{t.byQualityfriend}</a></div>
          </div>
        </div>
      </main>
    </div>
  );
}
