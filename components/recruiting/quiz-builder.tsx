"use client";

import { useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type ReactNode } from "react";
import type { RecruitingMessages } from "../../lib/i18n/recruiting-messages";
import { JOB_ICON_CATS, JOB_ICONS, allJobIcons, type JobIconCat } from "./job-icons";

type T = RecruitingMessages;

export const QUIZ_IMAGE_PLACEHOLDER = "/recruiting/image-placeholder.png";
export const QUIZ_FUNNEL1 = "/recruiting/funnel1.png";
export const QUIZ_FUNNEL2 = "/recruiting/funnel2.png";
export const QUIZ_DUMMY = "/recruiting/dummy.png";
export const QUIZ_VOICE_AVATAR = "/recruiting/colleagues3.png";
export const QUIZ_VOICE_SAMPLE = "/recruiting/voice-sample.mp3";
export const QUIZ_LOGO = "/recruiting/logo-icon.png";
export const LOGO_ID = "quiz-logo";

export type QuizElementType =
  | "text" | "text_small" | "text_header" | "icons" | "button" | "image" | "audio"
  | "spacers" | "video" | "single" | "multi" | "area" | "file" | "form" | "columns" | "quote";

export type QuizChoice = { id: string; label: string; icon: string; nextPageId: string };

export type QuizElement = {
  id: string;
  type: QuizElementType;
  text: string;
  fontSize: number;
  align: "left" | "center" | "right";
  src: string;
  avatarSrc: string;
  nextPageId: string;
  icon: string;
  placeholder: string;
  options: QuizChoice[];
  /** "columns" element: one element list per column, each item is a normal (editable / draggable) element. */
  columns: QuizElement[][];
  /** Text colour (empty = theme default). */
  color: string;
  /** Background colour behind the element (empty = none). */
  bgColor: string;
  /** Fill colour for buttons / choice tiles (empty = theme accent). */
  btnColor: string;
  /** Border colour for buttons / images (empty = none). */
  borderColor: string;
  borderWidth: number;
  radius: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  /** Image width in % of the page, spacer height in px. */
  width: number;
  height: number;
  /** Spacer: draw a divider line. */
  line: boolean;
};

export type QuizPage = {
  id: string;
  name: string;
  locked?: boolean;
  elements: QuizElement[];
  logo: QuizElement;
};

const PALETTE: Array<{ type: QuizElementType; icon: string; label: (t: T) => string }> = [
  { type: "text", icon: "T", label: (t) => t.elText },
  { type: "text_small", icon: "t", label: (t) => t.elTextSmall },
  { type: "text_header", icon: "H", label: (t) => t.elHeader },
  { type: "icons", icon: "😊", label: (t) => t.elIcons },
  { type: "button", icon: "▢", label: (t) => t.elButton },
  { type: "image", icon: "🖼️", label: (t) => t.elImage },
  { type: "audio", icon: "🎙️", label: (t) => t.elVoice },
  { type: "spacers", icon: "—", label: (t) => t.elSpacer },
  { type: "video", icon: "▶", label: (t) => t.elVideo },
  { type: "single", icon: "◉", label: (t) => t.elSingle },
  { type: "multi", icon: "☑", label: (t) => t.elMulti },
  { type: "area", icon: "▭", label: (t) => t.elArea },
  { type: "file", icon: "📎", label: (t) => t.elFile },
  { type: "form", icon: "📝", label: (t) => t.elForm },
  { type: "columns", icon: "▯▯", label: (t) => t.elColumns },
];

export function elementLabel(type: QuizElementType, t: T) {
  const item = PALETTE.find((entry) => entry.type === type);
  if (item) return item.label(t);
  return t.ownerQuote;
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function blank(partial: Partial<QuizElement> & Pick<QuizElement, "type">): QuizElement {
  return {
    id: uid("el"),
    text: "",
    fontSize: 14,
    align: "center",
    src: "",
    avatarSrc: "",
    nextPageId: "",
    icon: "😊",
    placeholder: "",
    options: [],
    columns: [],
    color: "",
    bgColor: "",
    btnColor: "",
    borderColor: "",
    borderWidth: 0,
    radius: partial.type === "button" || partial.type === "file" || partial.type === "form" ? 50 : 0,
    bold: partial.type === "text_header",
    italic: false,
    underline: false,
    width: 80,
    height: 20,
    line: true,
    ...partial,
  };
}

export function createElement(type: QuizElementType, t: T, nextPageId = ""): QuizElement {
  switch (type) {
    case "text":
      return blank({ type, text: t.quizLookingCopy, fontSize: 14 });
    case "text_small":
      return blank({ type, text: t.elTextSmallSample, fontSize: 12 });
    case "text_header":
      return blank({ type, text: t.elHeaderSample, fontSize: 22 });
    case "icons":
      return blank({ type, icon: "😊", fontSize: 36 });
    case "button":
      return blank({ type, text: t.wantLearn, nextPageId });
    case "image":
      return blank({ type, src: QUIZ_IMAGE_PLACEHOLDER });
    case "audio":
      return blank({ type, src: QUIZ_VOICE_SAMPLE, avatarSrc: QUIZ_VOICE_AVATAR });
    case "spacers":
      return blank({ type });
    case "video":
      return blank({ type, src: "https://player.vimeo.com/video/732025226" });
    case "single":
      return blank({
        type,
        options: [
          { id: uid("opt"), label: t.yesHave, icon: "👍", nextPageId },
          { id: uid("opt"), label: t.noHavent, icon: "👎", nextPageId: "disqualify" },
        ],
      });
    case "multi":
      return blank({
        type,
        options: [
          { id: uid("opt"), label: t.optStable, icon: "🛡️", nextPageId: "" },
          { id: uid("opt"), label: t.optHours, icon: "⏰", nextPageId: "" },
          { id: uid("opt"), label: t.optLearn, icon: "📚", nextPageId: "" },
        ],
      });
    case "area":
      return blank({ type, placeholder: t.areaPlaceholder });
    case "file":
      return blank({ type, text: t.send, nextPageId });
    case "form":
      return blank({ type, text: t.formSubmit, nextPageId: "thanks" });
    case "columns":
      return cols([
        [ic("💰", 45), hdr(t.featSalary, 17), body(t.featSalaryText)],
        [ic("🔧", 45), hdr(t.featTools, 17), body(t.featToolsText)],
      ]);
    case "quote":
      return blank({ type, text: t.ownerQuote, src: QUIZ_VOICE_SAMPLE, avatarSrc: QUIZ_VOICE_AVATAR });
  }
}

function opt(label: string, icon: string, nextPageId = ""): QuizChoice {
  return { id: uid("opt"), label, icon, nextPageId };
}
function hdr(text: string, fontSize = 24): QuizElement {
  return blank({ type: "text_header", text, fontSize });
}
function body(text: string, fontSize = 14): QuizElement {
  return blank({ type: "text", text, fontSize });
}
function btn(text: string, nextPageId: string): QuizElement {
  return blank({ type: "button", text, nextPageId });
}
function pic(src: string): QuizElement {
  return blank({ type: "image", src });
}
function voice(avatar = QUIZ_VOICE_AVATAR): QuizElement {
  return blank({ type: "audio", src: QUIZ_VOICE_SAMPLE, avatarSrc: avatar });
}
function ic(icon: string, fontSize = 70): QuizElement {
  return blank({ type: "icons", icon, fontSize });
}
function single(options: QuizChoice[]): QuizElement {
  return blank({ type: "single", options });
}
function multi(options: QuizChoice[]): QuizElement {
  return blank({ type: "multi", options });
}
/** Two side-by-side sections; every item inside is its own element (icon / title / text …). */
function cols(columns: QuizElement[][]): QuizElement {
  return blank({ type: "columns", columns: [columns[0] ?? [], columns[1] ?? []], align: "center" });
}
function quote(text: string): QuizElement {
  return blank({ type: "quote", text, src: QUIZ_VOICE_SAMPLE, avatarSrc: QUIZ_VOICE_AVATAR });
}

function defaultLogo(): QuizElement {
  return blank({ id: LOGO_ID, type: "image", src: QUIZ_LOGO, align: "center", width: 28 });
}

export function createDefaultQuiz(t: T): QuizPage[] {
  return [
    {
      id: "advantages",
      name: t.pageAdvantages,
      elements: [
        body(t.quizLookingCopy),
        hdr(t.elHeaderSample, 40),
        body(t.advantagesSub),
        pic(QUIZ_FUNNEL1),
        pic(QUIZ_DUMMY),
        btn(t.wantLearn, "company"),
        body(t.advantagesMeta),
        body(t.yourAdvantages),
        hdr(t.awaitsYou, 17),
        cols([
          [ic("💰", 45), hdr(t.featSalary, 17), body(t.featSalaryText)],
          [ic("🔧", 45), hdr(t.featTools, 17), body(t.featToolsText)],
        ]),
        cols([
          [ic("🤝", 45), hdr(t.featTeam, 17), body(t.featTeamText)],
          [ic("📍", 45), hdr(t.featStable, 17), body(t.featStableText)],
        ]),
        quote(t.ownerQuote),
      ],
    },
    {
      id: "company",
      name: t.pageCompany,
      elements: [
        body(t.introduceBriefly),
        hdr(t.thisIsUs, 40),
        pic(QUIZ_FUNNEL2),
        btn(t.applyNow, "q1"),
        body(t.companyStory),
        body(t.yourTasks),
        hdr(t.everydayWork, 40),
      ],
    },
    {
      id: "q1",
      name: t.pageQ1,
      elements: [
        hdr(t.q1Prompt, 24),
        single([opt(t.yesHave, "👍", "q2"), opt(t.noHavent, "👎", "disqualify")]),
      ],
    },
    {
      id: "q2",
      name: t.pageQ2,
      elements: [
        body(t.multiHint, 14),
        hdr(t.q2Prompt, 24),
        multi([opt(t.optStable, "🛡️"), opt(t.optHours, "⏰"), opt(t.optLearn, "📚"), opt(t.optCreative, "✨")]),
        btn(t.toNextQuestion, "q3"),
      ],
    },
    {
      id: "q3",
      name: t.pageQ3,
      elements: [
        hdr(t.q3Prompt, 24),
        single([
          opt(t.exp1, "🌱", "q4"),
          opt(t.exp15, "🌿", "q4"),
          opt(t.exp610, "🌳", "q4"),
          opt(t.exp10, "⭐", "q4"),
        ]),
      ],
    },
    {
      id: "q4",
      name: t.pageQ4,
      elements: [
        voice(),
        body(t.doneIt),
        hdr(t.q4Prompt, 24),
        createElement("area", t),
        btn(t.toNextQuestion, "q5"),
      ],
    },
    {
      id: "q5",
      name: t.pageQ5,
      elements: [
        hdr(t.q5Prompt, 24),
        single([
          opt(t.startAnytime, "🚀", "q6"),
          opt(t.start23weeks, "📅", "q6"),
          opt(t.start12months, "🗓️", "q6"),
          opt(t.start2plus, "⏳", "q6"),
        ]),
      ],
    },
    {
      id: "q6",
      name: t.pageQ6,
      elements: [
        hdr(t.q6Prompt, 24),
        { ...createElement("file", t, "q7"), nextPageId: "q7" },
        body(t.cvSafeNote),
      ],
    },
    {
      id: "q7",
      name: t.pageQ7,
      elements: [
        body(t.q7Intro),
        hdr(t.q7Prompt, 24),
        single([
          opt(t.time1012, "🕙", "data"),
          opt(t.time122, "🕛", "data"),
          opt(t.time24, "🕓", "data"),
          opt(t.time46, "🕕", "data"),
        ]),
      ],
    },
    {
      id: "data",
      name: t.pageData,
      locked: true,
      elements: [
        voice(),
        hdr(t.contactPerson),
        body(t.contactPersonSub),
        createElement("form", t),
      ],
    },
    {
      id: "thanks",
      name: t.pageThanks,
      locked: true,
      elements: [
        ic("✅", 70),
        hdr(t.thanksCopy, 30),
        pic("/recruiting/thanks.png"),
      ],
    },
    {
      id: "disqualify",
      name: t.pageDisqualify,
      locked: true,
      elements: [
        ic("❌", 70),
        hdr(t.disqualifyCopy, 30),
        body(t.disqualifySub),
        blank({ type: "text_header", text: t.disqualifySteps, fontSize: 14 }),
      ],
    },
  ].map((item) => ({ ...item, logo: defaultLogo() }));
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                       */
/* ------------------------------------------------------------------ */

const DND_TYPE = "application/x-quiz-el";
const DND_MOVE = "application/x-quiz-move";

/** `parentId` null = page list. `col` is the column index when nested. */
type NestLoc = { parentId: string | null; col: number; index: number };

type BuilderProps = {
  t: T;
  pages: QuizPage[];
  setPages: (pages: QuizPage[]) => void;
  activePageId: string;
  setActivePageId: (id: string) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
};

function findElement(elements: QuizElement[], id: string | null): QuizElement | null {
  if (!id) return null;
  for (const el of elements) {
    if (el.id === id) return el;
    const nested = findElement(el.columns.flat(), id);
    if (nested) return nested;
  }
  return null;
}

function locate(elements: QuizElement[], id: string): NestLoc | null {
  const top = elements.findIndex((el) => el.id === id);
  if (top >= 0) return { parentId: null, col: -1, index: top };
  for (const el of elements) {
    for (let col = 0; col < el.columns.length; col++) {
      const index = el.columns[col].findIndex((child) => child.id === id);
      if (index >= 0) return { parentId: el.id, col, index };
    }
  }
  return null;
}

function sameLoc(a: NestLoc | null, b: NestLoc | null) {
  return !!a && !!b && a.parentId === b.parentId && a.col === b.col && a.index === b.index;
}

function mapList(elements: QuizElement[], loc: NestLoc, fn: (list: QuizElement[]) => QuizElement[]): QuizElement[] {
  if (loc.parentId === null) return fn(elements);
  return elements.map((el) => el.id !== loc.parentId ? el : {
    ...el,
    columns: el.columns.map((column, index) => index === loc.col ? fn(column) : column),
  });
}

function mapElement(elements: QuizElement[], id: string, fn: (el: QuizElement) => QuizElement): QuizElement[] {
  return elements.map((el) => {
    if (el.id === id) return fn(el);
    if (el.columns.length) return { ...el, columns: el.columns.map((column) => mapElement(column, id, fn)) };
    return el;
  });
}

function removeById(elements: QuizElement[], id: string): QuizElement[] {
  return elements.filter((el) => el.id !== id).map((el) => (
    el.columns.length ? { ...el, columns: el.columns.map((column) => removeById(column, id)) } : el
  ));
}

function insertAtLoc(elements: QuizElement[], loc: NestLoc, item: QuizElement): QuizElement[] {
  return mapList(elements, loc, (list) => {
    const next = [...list];
    next.splice(Math.max(0, Math.min(loc.index, next.length)), 0, item);
    return next;
  });
}

function listAt(elements: QuizElement[], loc: NestLoc): QuizElement[] {
  if (loc.parentId === null) return elements;
  return elements.find((el) => el.id === loc.parentId)?.columns[loc.col] ?? [];
}

function duplicateElement(element: QuizElement): QuizElement {
  return {
    ...element,
    id: uid("el"),
    options: element.options.map((row) => ({ ...row, id: uid("opt") })),
    columns: element.columns.map((column) => column.map(duplicateElement)),
  };
}

function readImageFile(file: File | undefined, onLoad: (dataUrl: string) => void) {
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = () => { if (typeof reader.result === "string") onLoad(reader.result); };
  reader.readAsDataURL(file);
}

/* ------------------------------------------------------------------ */
/* Left panel: pages list  ⇄  element inspector                         */
/* ------------------------------------------------------------------ */

export function QuizToolsCard(props: BuilderProps) {
  const { t, pages, setPages, activePageId, setActivePageId, selectedId, setSelectedId } = props;
  const [panel, setPanel] = useState<"pages" | "editor">("pages");
  const [tab, setTab] = useState<"ideas" | "elements">("ideas");
  const page = pages.find((item) => item.id === activePageId) ?? pages[0];
  const selected = selectedId === LOGO_ID && page ? page.logo : findElement(page?.elements ?? [], selectedId);

  // Selecting an element on the canvas opens its inspector (like the reference builder);
  // clearing the selection (delete / click on empty canvas) while inspecting returns to the pages list.
  const [seenSelectedId, setSeenSelectedId] = useState(selectedId);
  if (selectedId !== seenSelectedId) {
    setSeenSelectedId(selectedId);
    if (selectedId) { setPanel("editor"); setTab("ideas"); }
    else if (panel === "editor" && tab === "ideas") setPanel("pages");
  }

  function renamePage(id: string, name: string) {
    setPages(pages.map((item) => item.id === id ? { ...item, name } : item));
  }
  function openPage(id: string) {
    setActivePageId(id);
    setSelectedId(null);
    setPanel("pages");
  }
  function addPage() {
    const id = uid("page");
    setPages([...pages.filter((item) => !item.locked), { id, name: t.newPage, logo: { ...(page.logo ?? defaultLogo()), id: LOGO_ID }, elements: [createElement("text_header", t)] }, ...pages.filter((item) => item.locked)]);
    setActivePageId(id);
    setSelectedId(null);
  }
  function removePage(id: string) {
    const target = pages.find((item) => item.id === id);
    if (!target || target.locked) return;
    const next = pages.filter((item) => item.id !== id);
    setPages(next);
    if (activePageId === id) setActivePageId(next[0]?.id ?? "advantages");
  }
  function updateElements(elements: QuizElement[]) {
    setPages(pages.map((item) => item.id === page.id ? { ...item, elements } : item));
  }
  function patchElement(patch: Partial<QuizElement>) {
    if (!selected) return;
    if (selected.id === LOGO_ID) {
      const nextLogo = { ...(page.logo ?? defaultLogo()), ...patch, id: LOGO_ID, type: "image" as const };
      if (!nextLogo.src || nextLogo.src === QUIZ_IMAGE_PLACEHOLDER) nextLogo.src = QUIZ_LOGO;
      setPages(pages.map((item) => ({ ...item, logo: { ...nextLogo } })));
      return;
    }
    updateElements(mapElement(page.elements, selected.id, (el) => ({ ...el, ...patch })));
  }
  function addElement(type: QuizElementType) {
    const pageIndex = pages.findIndex((item) => item.id === page.id);
    const element = createElement(type, t, pages[pageIndex + 1]?.id ?? "");
    let loc: NestLoc = { parentId: null, col: -1, index: page.elements.length };
    if (selected) {
      const found = locate(page.elements, selected.id);
      if (found && found.parentId) loc = { ...found, index: found.index + 1 };
      else if (selected.type === "columns" && type !== "columns") {
        loc = { parentId: selected.id, col: 0, index: selected.columns[0]?.length ?? 0 };
      } else if (found) loc = { parentId: null, col: -1, index: found.index + 1 };
    }
    if (type === "columns" && loc.parentId) {
      const parentIndex = page.elements.findIndex((item) => item.id === loc.parentId);
      loc = { parentId: null, col: -1, index: parentIndex + 1 };
    }
    updateElements(insertAtLoc(page.elements, loc, element));
    setSelectedId(element.id);
  }
  function removeSelected() {
    if (!selected) return;
    updateElements(removeById(page.elements, selected.id));
    setSelectedId(null);
    setPanel("pages");
  }
  function duplicateSelected() {
    if (!selected) return;
    const found = locate(page.elements, selected.id);
    if (!found) return;
    const copy = duplicateElement(selected);
    updateElements(insertAtLoc(page.elements, { ...found, index: found.index + 1 }, copy));
    setSelectedId(copy.id);
  }
  function back() {
    setSelectedId(null);
    setPanel("pages");
  }

  if (panel === "editor") {
    return (
      <div className="card quiz-tools">
        <div className="quiz-panel-head">
          <button type="button" className="quiz-back" onClick={back} title={t.backToPages} aria-label={t.backToPages}>←</button>
          <div className="bud-tab-row">
            <button type="button" className={`bud-tab ${tab === "ideas" ? "active" : ""}`} onClick={() => setTab("ideas")}>{t.ideasTab}</button>
            <button type="button" className={`bud-tab ${tab === "elements" ? "active" : ""}`} onClick={() => setTab("elements")}>{t.elementsTab}</button>
          </div>
        </div>
        <div className="cb quiz-panel-body">
          {tab === "elements" ? (
            <ElementPalette t={t} onAdd={addElement} />
          ) : selected ? (
            <>
              <div className="quiz-panel-title">{selected.id === LOGO_ID ? t.logo : elementLabel(selected.type, t)}</div>
              <IdeasForm t={t} pages={pages} element={selected} onChange={patchElement} />
              {selected.id === LOGO_ID ? null : (
              <div className="quiz-prop quiz-prop-actions">
                <button type="button" className="btn btn-ghost" onClick={duplicateSelected}>⧉ {t.duplicateEl}</button>
                <button type="button" className="btn btn-ghost quiz-danger" onClick={removeSelected}>🗑 {t.deleteEl}</button>
              </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 12.5, color: "var(--text3)", padding: "8px 0" }}>{t.ideasEmpty}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card quiz-tools">
      <div className="ch"><div className="ct">{t.pagesStep}</div></div>
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="quiz-pages">
          {pages.filter((item) => !item.locked).map((item) => (
            <div
              key={item.id}
              className={`quiz-page ${item.id === activePageId ? "active" : ""}`}
              onClick={() => openPage(item.id)}
            >
              <input
                className="quiz-page-name"
                value={item.name}
                onFocus={() => { setActivePageId(item.id); setSelectedId(null); }}
                onChange={(event) => renamePage(item.id, event.target.value)}
                onClick={(event) => event.stopPropagation()}
              />
              <button type="button" className="icon-btn danger" onClick={(event) => { event.stopPropagation(); removePage(item.id); }}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" style={{ width: "100%" }} onClick={addPage}>{t.addPage}</button>
          <div className="quiz-fixed-label">{t.fixedPages}</div>
          {pages.filter((item) => item.locked).map((item) => (
            <div
              key={item.id}
              className={`quiz-page locked ${item.id === activePageId ? "active" : ""}`}
              onClick={() => openPage(item.id)}
            >
              <span className="quiz-page-name">{item.name}</span>
            </div>
          ))}
        </div>
        <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={() => { setSelectedId(null); setPanel("editor"); setTab("elements"); }}>
          {t.addElements}
        </button>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>{t.ideasEmpty}</div>
      </div>
    </div>
  );
}

function ElementPalette({ t, onAdd }: { t: T; onAdd: (type: QuizElementType) => void }) {
  return (
    <>
      <div className="quiz-el-grid">
        {PALETTE.map((item) => (
          <button
            key={item.type}
            type="button"
            className="quiz-el"
            draggable
            title={t.dropHint}
            onDragStart={(event) => {
              event.dataTransfer.setData(DND_TYPE, item.type);
              event.dataTransfer.setData("text/plain", item.type);
              event.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => onAdd(item.type)}
          >
            <span className="quiz-el-ic">{item.icon}</span>
            <span>{item.label(t)}</span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 10 }}>{t.dropHint}</div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Inspector controls                                                   */
/* ------------------------------------------------------------------ */

function Prop({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="quiz-prop">
      <div className="quiz-prop-title">{title}</div>
      {children}
    </div>
  );
}

function AlignRow({ t, value, onChange }: { t: T; value: QuizElement["align"]; onChange: (align: QuizElement["align"]) => void }) {
  const items: Array<{ id: QuizElement["align"]; label: string; glyph: string }> = [
    { id: "left", label: t.alignLeft, glyph: "≡" },
    { id: "center", label: t.alignCenter, glyph: "≡" },
    { id: "right", label: t.alignRight, glyph: "≡" },
  ];
  return (
    <div className="quiz-align-row">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          title={item.label}
          aria-label={item.label}
          className={`quiz-align-btn ${value === item.id ? "active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          <span className={`quiz-align-glyph ${item.id}`}><i /><i /><i /></span>
        </button>
      ))}
    </div>
  );
}

function StyleRow({ t, element, onChange }: { t: T; element: QuizElement; onChange: (patch: Partial<QuizElement>) => void }) {
  return (
    <div className="quiz-style-row">
      <button type="button" title={t.bold} className={`quiz-style-btn ${element.bold ? "active" : ""}`} style={{ fontWeight: 800 }} onClick={() => onChange({ bold: !element.bold })}>B</button>
      <button type="button" title={t.italic} className={`quiz-style-btn ${element.italic ? "active" : ""}`} style={{ fontStyle: "italic" }} onClick={() => onChange({ italic: !element.italic })}>I</button>
      <button type="button" title={t.underline} className={`quiz-style-btn ${element.underline ? "active" : ""}`} style={{ textDecoration: "underline" }} onClick={() => onChange({ underline: !element.underline })}>U</button>
    </div>
  );
}

function ColorRow({ t, value, fallback, onChange }: { t: T; value: string; fallback: string; onChange: (value: string) => void }) {
  return (
    <div className="quiz-color-row">
      <label className="quiz-color" style={{ background: value || fallback }}>
        <input type="color" value={value || fallback} onChange={(event) => onChange(event.target.value)} />
      </label>
      <input className="field-input" value={value} placeholder={fallback} onChange={(event) => onChange(event.target.value)} />
      <button type="button" className="icon-btn" title={t.resetColor} aria-label={t.resetColor} onClick={() => onChange("")} disabled={!value}>↺</button>
    </div>
  );
}

function RangeRow({ value, min, max, step = 1, unit, onChange }: { value: number; min: number; max: number; step?: number; unit: string; onChange: (value: number) => void }) {
  return (
    <div className="quiz-range-row">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <input className="field-input" type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))} />
      <span className="quiz-range-unit">{unit}</span>
    </div>
  );
}

function ImageDrop({ t, src, onChange }: { t: T; src: string; onChange: (src: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const fileName = src.startsWith("data:") ? t.elImage : src.split("/").pop() || "";
  return (
    <div
      className={`quiz-img-drop ${over ? "over" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        readImageFile(event.dataTransfer.files?.[0], onChange);
      }}
    >
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(event) => { readImageFile(event.target.files?.[0], onChange); event.target.value = ""; }} />
      <img src={src || QUIZ_IMAGE_PLACEHOLDER} alt="" />
      <div className="quiz-img-drop-overlay">
        {src && src !== QUIZ_IMAGE_PLACEHOLDER ? (
          <button type="button" className="quiz-img-remove" onClick={(event) => { event.stopPropagation(); onChange(QUIZ_IMAGE_PLACEHOLDER); }}>{t.removeImage}</button>
        ) : null}
        <strong>{fileName}</strong>
        <span>{t.dropOrClick}</span>
      </div>
    </div>
  );
}

function iconCatLabel(cat: JobIconCat, t: T) {
  if (cat === "work") return t.iconCatWork;
  if (cat === "people") return t.iconCatPeople;
  if (cat === "pay") return t.iconCatPay;
  if (cat === "time") return t.iconCatTime;
  if (cat === "place") return t.iconCatPlace;
  if (cat === "tools") return t.iconCatTools;
  if (cat === "learn") return t.iconCatLearn;
  if (cat === "health") return t.iconCatHealth;
  if (cat === "status") return t.iconCatStatus;
  return t.iconCatMore;
}

function IconPicker({ t, value, onChange, compact = false, insert = false }: { t: T; value: string; onChange: (icon: string) => void; compact?: boolean; insert?: boolean }) {
  const [open, setOpen] = useState(!compact && !insert);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<JobIconCat | "all">(insert ? "people" : "all");
  const needle = query.trim().toLowerCase();
  const icons = (cat === "all" ? allJobIcons() : JOB_ICONS[cat]).filter((item) => !needle || item.tags.includes(needle) || item.glyph === needle);

  return (
    <div className={`quiz-icon-picker ${compact ? "compact" : ""} ${insert ? "insert" : ""}`}>
      {insert ? (
        <button type="button" className={`quiz-emoji-btn ${open ? "open" : ""}`} title={t.emoji} aria-label={t.emoji} onClick={() => setOpen((on) => !on)}>😀</button>
      ) : (
        <button type="button" className="quiz-icon-current" title={t.pickIcon} onClick={() => setOpen((on) => !on)}>
          <span className="quiz-icon-current-glyph">{value || "😊"}</span>
          {compact ? null : <span>{t.pickIcon}</span>}
        </button>
      )}
      {open ? (
        <div className="quiz-icon-panel">
          <input className="field-input" value={query} placeholder={t.searchIcons} onChange={(event) => setQuery(event.target.value)} />
          <div className="quiz-icon-cats">
            <button type="button" className={`quiz-icon-cat ${cat === "all" ? "active" : ""}`} onClick={() => setCat("all")}>{t.elIcons}</button>
            {JOB_ICON_CATS.map((item) => (
              <button key={item} type="button" className={`quiz-icon-cat ${cat === item ? "active" : ""}`} onClick={() => setCat(item)}>{iconCatLabel(item, t)}</button>
            ))}
          </div>
          <div className="quiz-icon-grid">
            {icons.map((item) => (
              <button
                key={item.glyph}
                type="button"
                title={item.tags}
                className={`quiz-icon-cell ${!insert && value === item.glyph ? "active" : ""}`}
                onClick={() => onChange(item.glyph)}
              >
                {item.glyph}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function insertAtCaret(field: HTMLTextAreaElement | HTMLInputElement | null, value: string, glyph: string, caret: { start: number; end: number }, onChange: (next: string) => void) {
  const from = Math.min(caret.start, value.length);
  const to = Math.min(caret.end, value.length);
  onChange(value.slice(0, from) + glyph + value.slice(to));
  const pos = from + glyph.length;
  caret.start = pos;
  caret.end = pos;
  queueMicrotask(() => {
    field?.focus();
    field?.setSelectionRange(pos, pos);
  });
}

function TextWithEmoji({ t, value, onChange, rows = 2, multiline = true }: { t: T; value: string; onChange: (value: string) => void; rows?: number; multiline?: boolean }) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const caret = useRef({ start: value.length, end: value.length });
  function remember(el: HTMLTextAreaElement | HTMLInputElement | null) {
    if (!el) return;
    caret.current = { start: el.selectionStart ?? value.length, end: el.selectionEnd ?? value.length };
  }
  function insert(glyph: string) {
    insertAtCaret(multiline ? areaRef.current : inputRef.current, value, glyph, caret.current, onChange);
  }
  const fieldProps = {
    className: "field-input" + (multiline ? " quiz-textarea" : ""),
    value,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    onSelect: (event: { currentTarget: HTMLTextAreaElement | HTMLInputElement }) => remember(event.currentTarget),
    onKeyUp: (event: { currentTarget: HTMLTextAreaElement | HTMLInputElement }) => remember(event.currentTarget),
    onClick: (event: { currentTarget: HTMLTextAreaElement | HTMLInputElement }) => remember(event.currentTarget),
    onBlur: (event: { currentTarget: HTMLTextAreaElement | HTMLInputElement }) => remember(event.currentTarget),
  };
  return (
    <div className="quiz-text-emoji">
      {multiline ? <textarea ref={areaRef} rows={rows} {...fieldProps} /> : <input ref={inputRef} {...fieldProps} />}
      <div>
        <div className="quiz-prop-title">{t.emoji}</div>
        <IconPicker t={t} insert value="" onChange={insert} />
      </div>
    </div>
  );
}

function IdeasForm({ t, pages, element, onChange }: { t: T; pages: QuizPage[]; element: QuizElement; onChange: (patch: Partial<QuizElement>) => void }) {
  const voiceRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const isText = element.type === "text" || element.type === "text_small" || element.type === "text_header";
  const isButtonLike = element.type === "button" || element.type === "file" || element.type === "form";
  const isChoice = element.type === "single" || element.type === "multi";
  const hasAlign = isText || element.type === "icons" || element.type === "button" || element.type === "image" || element.type === "audio" || element.type === "video";
  const hasBg = element.type !== "spacers";
  const pageOptions = pages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>);

  function pickFile(input: HTMLInputElement | null, field: "src" | "avatarSrc") {
    const file = input?.files?.[0];
    if (!file) return;
    onChange({ [field]: URL.createObjectURL(file) });
  }
  function patchOption(index: number, patch: Partial<QuizChoice>) {
    onChange({ options: element.options.map((row, i) => i === index ? { ...row, ...patch } : row) });
  }

  return (
    <div className="quiz-props">
      {element.type === "image" ? (
        <Prop title={t.elImage}>
          <ImageDrop t={t} src={element.src} onChange={(src) => onChange({ src })} />
        </Prop>
      ) : null}

      {isText || isButtonLike || element.type === "quote" ? (
        <Prop title={t.elText}>
          <TextWithEmoji t={t} rows={isText ? 3 : 2} value={element.text} onChange={(text) => onChange({ text })} />
        </Prop>
      ) : null}

      {element.type === "icons" ? (
        <Prop title={t.elIcons}>
          <IconPicker t={t} value={element.icon} onChange={(icon) => onChange({ icon })} />
        </Prop>
      ) : null}

      {element.type === "area" ? (
        <Prop title={t.elArea}>
          <TextWithEmoji t={t} multiline={false} value={element.placeholder} onChange={(placeholder) => onChange({ placeholder })} />
        </Prop>
      ) : null}

      {element.type === "video" ? (
        <Prop title={t.videoUrl}>
          <input className="field-input" value={element.src} onChange={(event) => onChange({ src: event.target.value })} />
        </Prop>
      ) : null}

      {isButtonLike ? (
        <Prop title={t.nextPage}>
          <select className="field-select" value={element.nextPageId} onChange={(event) => onChange({ nextPageId: event.target.value })}>
            <option value="">{t.choosePage}</option>
            {pageOptions}
          </select>
        </Prop>
      ) : null}

      {isChoice ? (
        <Prop title={element.type === "single" ? t.elSingle : t.elMulti}>
          {element.options.map((option, index) => (
            <div key={option.id} className="quiz-opt-edit">
              <IconPicker t={t} compact value={option.icon} onChange={(icon) => patchOption(index, { icon })} />
              <input className="field-input" value={option.label} onChange={(event) => patchOption(index, { label: event.target.value })} />
              {element.type === "single" ? (
                <select className="field-select" style={{ maxWidth: 110 }} value={option.nextPageId} onChange={(event) => patchOption(index, { nextPageId: event.target.value })}>
                  <option value="">{t.nextPage}</option>
                  {pageOptions}
                </select>
              ) : null}
              <button type="button" className="icon-btn danger" title={t.removeOption} aria-label={t.removeOption} onClick={() => onChange({ options: element.options.filter((_, i) => i !== index) })}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={() => onChange({ options: [...element.options, { id: uid("opt"), label: t.newOption, icon: "➕", nextPageId: "" }] })}>{t.addOption}</button>
        </Prop>
      ) : null}

      {element.type === "columns" ? (
        <div className="quiz-prop">
          <div className="quiz-prop-title">{t.elColumns}</div>
          <div style={{ fontSize: 12.5, color: "var(--text3)", lineHeight: 1.45 }}>{t.columnsHint}</div>
        </div>
      ) : null}

      {element.type === "audio" || element.type === "quote" ? (
        <>
          <Prop title={t.replaceAvatar}>
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={() => pickFile(avatarRef.current, "avatarSrc")} />
            <button type="button" className="dropzone" style={{ marginBottom: 0, padding: 14 }} onClick={() => avatarRef.current?.click()}>{t.replaceAvatar}</button>
          </Prop>
          <Prop title={t.replaceVoice}>
            <input ref={voiceRef} type="file" accept="audio/*" hidden onChange={() => pickFile(voiceRef.current, "src")} />
            <button type="button" className="dropzone" style={{ marginBottom: 0, padding: 14 }} onClick={() => voiceRef.current?.click()}>{t.replaceVoice}</button>
          </Prop>
        </>
      ) : null}

      {isText ? (
        <Prop title={t.fontSize}>
          <RangeRow value={element.fontSize} min={10} max={64} unit="px" onChange={(fontSize) => onChange({ fontSize })} />
        </Prop>
      ) : null}
      {element.type === "icons" ? (
        <Prop title={t.iconSize}>
          <RangeRow value={element.fontSize} min={16} max={120} unit="px" onChange={(fontSize) => onChange({ fontSize })} />
        </Prop>
      ) : null}

      {isText || isButtonLike || isChoice || element.type === "quote" ? (
        <Prop title={t.textStyle}>
          <StyleRow t={t} element={element} onChange={onChange} />
        </Prop>
      ) : null}

      {isText || isButtonLike || isChoice || element.type === "quote" ? (
        <Prop title={t.textColor}>
          <ColorRow t={t} value={element.color} fallback={isButtonLike || isChoice ? "#ffffff" : "#1c2233"} onChange={(color) => onChange({ color })} />
        </Prop>
      ) : null}

      {isButtonLike || isChoice ? (
        <Prop title={t.buttonColor}>
          <ColorRow t={t} value={element.btnColor} fallback={isChoice ? "#3d5158" : "#C4933A"} onChange={(btnColor) => onChange({ btnColor })} />
        </Prop>
      ) : null}

      {isButtonLike || element.type === "image" ? (
        <>
          <Prop title={t.borderColor}>
            <ColorRow t={t} value={element.borderColor} fallback="#1c2233" onChange={(borderColor) => onChange({ borderColor })} />
          </Prop>
          <Prop title={t.borderWidth}>
            <RangeRow value={element.borderWidth} min={0} max={8} unit="px" onChange={(borderWidth) => onChange({ borderWidth })} />
          </Prop>
          <Prop title={t.cornerRadius}>
            <RangeRow value={element.radius} min={0} max={50} unit="px" onChange={(radius) => onChange({ radius })} />
          </Prop>
        </>
      ) : null}

      {element.type === "image" ? (
        <Prop title={t.imageWidth}>
          <RangeRow value={element.width} min={10} max={100} step={5} unit="%" onChange={(width) => onChange({ width })} />
        </Prop>
      ) : null}

      {element.type === "spacers" ? (
        <>
          <Prop title={t.spacerHeight}>
            <RangeRow value={element.height} min={4} max={120} step={2} unit="px" onChange={(height) => onChange({ height })} />
          </Prop>
          <Prop title={t.showLine}>
            <label className="quiz-check"><input type="checkbox" checked={element.line} onChange={(event) => onChange({ line: event.target.checked })} /> {t.showLine}</label>
          </Prop>
        </>
      ) : null}

      {hasAlign ? (
        <Prop title={t.align}>
          <AlignRow t={t} value={element.align} onChange={(align) => onChange({ align })} />
        </Prop>
      ) : null}

      {hasBg ? (
        <Prop title={t.bgColor}>
          <ColorRow t={t} value={element.bgColor} fallback="#ffffff" onChange={(bgColor) => onChange({ bgColor })} />
        </Prop>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Canvas                                                               */
/* ------------------------------------------------------------------ */

export function QuizCanvasCard({ t, pages, setPages, activePageId, setActivePageId, selectedId, setSelectedId, onPublish, onDraft }: BuilderProps & {
  onPublish: () => void;
  onDraft: () => void;
}) {
  const [dropAt, setDropAt] = useState<NestLoc | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const page = pages.find((item) => item.id === activePageId) ?? pages[0];
  if (!page) return null;
  const pageIndex = pages.findIndex((item) => item.id === page.id);
  const count = page.elements.length;
  const endLoc: NestLoc = { parentId: null, col: -1, index: count };

  function updateElements(elements: QuizElement[]) {
    setPages(pages.map((item) => item.id === page.id ? { ...item, elements } : item));
  }
  function isQuizDrag(event: DragEvent) {
    return Array.from(event.dataTransfer.types).includes(DND_TYPE) || Array.from(event.dataTransfer.types).includes(DND_MOVE);
  }
  function indexFor(event: DragEvent, index: number) {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? index : index + 1;
  }
  function finishDrop(event: DragEvent, dest: NestLoc) {
    event.preventDefault();
    setDropAt(null);
    setDraggingId(null);
    const moveId = event.dataTransfer.getData(DND_MOVE);
    if (moveId) {
      const from = locate(page.elements, moveId);
      const moved = findElement(page.elements, moveId);
      if (!from || !moved) return;
      if (dest.parentId === moveId) return;
      if (moved.type === "columns" && dest.parentId) return;
      let destAdj = { ...dest };
      if (from.parentId === dest.parentId && from.col === dest.col && from.index < dest.index) destAdj.index -= 1;
      if (from.parentId === destAdj.parentId && from.col === destAdj.col && destAdj.index === from.index) return;
      updateElements(insertAtLoc(removeById(page.elements, moveId), destAdj, moved));
      return;
    }
    const type = (event.dataTransfer.getData(DND_TYPE) || event.dataTransfer.getData("text/plain")) as QuizElementType;
    if (!type || !PALETTE.some((item) => item.type === type)) return;
    let loc = dest;
    if (type === "columns" && loc.parentId) {
      const parentIndex = page.elements.findIndex((item) => item.id === loc.parentId);
      loc = { parentId: null, col: -1, index: parentIndex + 1 };
    }
    const element = createElement(type, t, pages[pageIndex + 1]?.id ?? "");
    updateElements(insertAtLoc(page.elements, loc, element));
    setSelectedId(element.id);
  }
  function moveBy(id: string, delta: -1 | 1) {
    const from = locate(page.elements, id);
    if (!from) return;
    const list = listAt(page.elements, from);
    const to = from.index + delta;
    if (to < 0 || to >= list.length) return;
    updateElements(mapList(page.elements, from, (items) => {
      const next = [...items];
      const [moved] = next.splice(from.index, 1);
      next.splice(to, 0, moved);
      return next;
    }));
  }
  function removeElement(id: string) {
    updateElements(removeById(page.elements, id));
    if (selectedId === id) setSelectedId(null);
  }
  function duplicate(id: string) {
    const from = locate(page.elements, id);
    const source = findElement(page.elements, id);
    if (!from || !source) return;
    const copy = duplicateElement(source);
    updateElements(insertAtLoc(page.elements, { ...from, index: from.index + 1 }, copy));
    setSelectedId(copy.id);
  }
  function go(nextId: string) {
    if (!nextId) return;
    if (pages.some((item) => item.id === nextId)) {
      setActivePageId(nextId);
      setSelectedId(null);
    }
  }
  function blockProps(element: QuizElement, loc: NestLoc, nested: boolean) {
    const list = listAt(page.elements, loc);
    return {
      className: `quiz-block ${nested ? "nested" : ""} ${selectedId === element.id ? "selected" : ""} ${draggingId === element.id ? "dragging" : ""}`,
      draggable: true,
      onDragStart: (event: DragEvent) => {
        event.stopPropagation();
        event.dataTransfer.setData(DND_MOVE, element.id);
        event.dataTransfer.effectAllowed = "move";
        setDraggingId(element.id);
        setSelectedId(element.id);
      },
      onDragEnd: () => { setDraggingId(null); setDropAt(null); },
      onDragOver: (event: DragEvent) => {
        if (!isQuizDrag(event)) return;
        event.preventDefault();
        event.stopPropagation();
        const next = { ...loc, index: indexFor(event, loc.index) };
        if (!sameLoc(next, dropAt)) setDropAt(next);
      },
      onDrop: (event: DragEvent) => {
        event.stopPropagation();
        finishDrop(event, { ...loc, index: indexFor(event, loc.index) });
      },
      onClick: (event: MouseEvent) => { event.stopPropagation(); setSelectedId(element.id); },
      toolbar: (
        <div className="quiz-tools-bar" onClick={(event) => event.stopPropagation()}>
          <span className="quiz-tool quiz-handle" title={t.dragToMove}>⠿</span>
          <button type="button" className="quiz-tool" title={t.moveUp} aria-label={t.moveUp} disabled={loc.index === 0} onClick={() => moveBy(element.id, -1)}>↑</button>
          <button type="button" className="quiz-tool" title={t.moveDown} aria-label={t.moveDown} disabled={loc.index === list.length - 1} onClick={() => moveBy(element.id, 1)}>↓</button>
          <button type="button" className="quiz-tool" title={t.duplicateEl} aria-label={t.duplicateEl} onClick={() => duplicate(element.id)}>⧉</button>
          <button type="button" className="quiz-tool danger" title={t.deleteEl} aria-label={t.deleteEl} onClick={() => removeElement(element.id)}>✕</button>
        </div>
      ),
    };
  }

  return (
    <div className="card">
      <div className="ch">
        <div className="ct">{page.name || t.quizCanvas}</div>
      </div>
      <div className="cb">
        <div className="quiz-phone quiz-funnel">
          <div
            className={`quiz-logo quiz-block ${selectedId === LOGO_ID ? "selected" : ""}`}
            style={{ justifyContent: page.logo?.align === "left" ? "flex-start" : page.logo?.align === "right" ? "flex-end" : "center" }}
            onClick={(event) => { event.stopPropagation(); setSelectedId(LOGO_ID); }}
          >
            <img
              src={page.logo?.src || QUIZ_LOGO}
              alt=""
              style={{
                width: `${page.logo?.width || 28}%`,
                maxWidth: "100%",
                margin: page.logo?.align === "left" ? "0 auto 0 0" : page.logo?.align === "right" ? "0 0 0 auto" : "0 auto",
                borderRadius: page.logo?.radius || 0,
                border: page.logo?.borderWidth ? `${page.logo.borderWidth}px solid ${page.logo.borderColor || "#1c2233"}` : undefined,
              }}
            />
          </div>
          <div
            className={`quiz-canvas ${dropAt ? "drag-over" : ""}`}
            onDragOver={(event) => {
              if (!isQuizDrag(event)) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = event.dataTransfer.types.includes(DND_MOVE) ? "move" : "copy";
              if (event.target === event.currentTarget || count === 0) setDropAt(endLoc);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropAt(null);
            }}
            onDrop={(event) => finishDrop(event, dropAt ?? endLoc)}
            onClick={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}
          >
            {count === 0 ? <div className={`quiz-empty ${dropAt && dropAt.parentId === null && dropAt.index === 0 ? "show" : ""}`}>{t.dropHint}</div> : null}
            {page.elements.map((element, index) => {
              const loc: NestLoc = { parentId: null, col: -1, index };
              const props = blockProps(element, loc, false);
              return (
                <div key={element.id} className="quiz-slot">
                  <div className={`quiz-insert ${sameLoc(dropAt, loc) ? "show" : ""}`} />
                  <div
                    className={props.className}
                    draggable={props.draggable}
                    onDragStart={props.onDragStart}
                    onDragEnd={props.onDragEnd}
                    onDragOver={element.type === "columns" ? undefined : props.onDragOver}
                    onDrop={element.type === "columns" ? undefined : props.onDrop}
                    onClick={props.onClick}
                  >
                    {props.toolbar}
                    {element.type === "columns" ? (
                      <div className="quiz-cols">
                        {[element.columns[0] ?? [], element.columns[1] ?? []].map((column, col) => {
                          const endOfCol: NestLoc = { parentId: element.id, col, index: column.length };
                          return (
                            <div
                              key={`${element.id}-${col}`}
                              className={`quiz-col ${dropAt?.parentId === element.id && dropAt.col === col ? "drop-over" : ""}`}
                              onClick={(event) => { event.stopPropagation(); setSelectedId(element.id); }}
                              onDragOver={(event) => {
                                if (!isQuizDrag(event)) return;
                                event.preventDefault();
                                event.stopPropagation();
                                if (!sameLoc(endOfCol, dropAt)) setDropAt(endOfCol);
                              }}
                              onDrop={(event) => { event.stopPropagation(); finishDrop(event, dropAt?.parentId === element.id && dropAt.col === col ? dropAt : endOfCol); }}
                            >
                              {column.map((child, childIndex) => {
                                const childLoc: NestLoc = { parentId: element.id, col, index: childIndex };
                                const childProps = blockProps(child, childLoc, true);
                                return (
                                  <div key={child.id} className="quiz-slot">
                                    <div className={`quiz-insert ${sameLoc(dropAt, childLoc) ? "show" : ""}`} />
                                    <div
                                      className={childProps.className}
                                      draggable={childProps.draggable}
                                      onDragStart={childProps.onDragStart}
                                      onDragEnd={childProps.onDragEnd}
                                      onDragOver={childProps.onDragOver}
                                      onDrop={childProps.onDrop}
                                      onClick={childProps.onClick}
                                    >
                                      {childProps.toolbar}
                                      <QuizBlock t={t} element={child} onGo={go} />
                                    </div>
                                  </div>
                                );
                              })}
                              <div className={`quiz-insert ${sameLoc(dropAt, endOfCol) ? "show" : ""}`} />
                              {column.length === 0 ? <div className="quiz-col-empty">{t.dropHere}</div> : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <QuizBlock t={t} element={element} onGo={go} />
                    )}
                  </div>
                </div>
              );
            })}
            {count ? <div className={`quiz-insert ${sameLoc(dropAt, endLoc) ? "show" : ""}`} /> : null}
          </div>
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-primary" onClick={onPublish}>{t.publish}</button>
          <button type="button" className="btn btn-ghost" onClick={onDraft}>{t.saveDraft}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Element rendering                                                    */
/* ------------------------------------------------------------------ */

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

function QuizBlock({ t, element, onGo }: { t: T; element: QuizElement; onGo: (id: string) => void }) {
  const wrap: CSSProperties = {
    textAlign: element.align,
    background: element.bgColor || undefined,
    padding: element.bgColor ? "12px 14px" : undefined,
    borderRadius: element.bgColor ? 8 : undefined,
  };
  if (element.type === "text" || element.type === "text_small" || element.type === "text_header") {
    return <div className="quiz-copy" style={{ ...wrap, ...textStyle(element), fontSize: element.fontSize, whiteSpace: "pre-wrap" }}>{element.text}</div>;
  }
  if (element.type === "icons") return <div style={{ ...wrap, fontSize: element.fontSize, lineHeight: 1 }}>{element.icon}</div>;
  if (element.type === "button") {
    return <div style={wrap}><button type="button" className="quiz-cta" style={ctaStyle(element)} onClick={() => onGo(element.nextPageId)}>{element.text}</button></div>;
  }
  if (element.type === "image") {
    return (
      <div style={wrap}>
        <img
          src={element.src || QUIZ_IMAGE_PLACEHOLDER}
          alt=""
          className="quiz-img"
          style={{
            display: "inline-block",
            width: `${element.width}%`,
            maxWidth: "100%",
            margin: "8px 0",
            borderRadius: element.radius,
            border: element.borderWidth ? `${element.borderWidth}px solid ${element.borderColor || "#1c2233"}` : undefined,
          }}
        />
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
    return (
      <div className="quiz-spacer" style={{ height: element.height, background: "none", display: "flex", alignItems: "center", margin: 0 }}>
        {element.line ? <div style={{ height: 1, width: "100%", background: "var(--border)" }} /> : null}
      </div>
    );
  }
  if (element.type === "video") {
    const src = element.src.includes("player.vimeo.com") || element.src.includes("youtube") ? element.src : `https://www.youtube.com/embed/${element.src}`;
    return <div style={wrap}><div className="quiz-video"><iframe title="video" src={src} allow="fullscreen" /></div></div>;
  }
  if (element.type === "single" || element.type === "multi") {
    return (
      <div className="quiz-choices" style={{ ...wrap, textAlign: undefined }}>
        {element.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className="quiz-choice"
            style={{ ...textStyle(element), background: element.btnColor || undefined }}
            onClick={() => element.type === "single" && onGo(option.nextPageId)}
          >
            {element.type === "multi" ? <input type="checkbox" readOnly /> : <span className="quiz-choice-arrow">›</span>}
            <span style={{ flex: 1, textAlign: "left", fontSize: 16 }}>{option.label}</span>
            <span className="quiz-choice-icon">{option.icon}</span>
          </button>
        ))}
      </div>
    );
  }
  if (element.type === "area") {
    return <div style={wrap}><textarea className="quiz-area" rows={6} placeholder={element.placeholder} readOnly /></div>;
  }
  if (element.type === "file") {
    return (
      <div style={{ ...wrap, textAlign: "center" }}>
        <div className="quiz-file">
          <div className="quiz-file-inner">
            <div className="quiz-file-ic">⬆</div>
            <div>{t.clickOrDropFile}</div>
          </div>
        </div>
        <button type="button" className="quiz-cta" style={ctaStyle(element)} onClick={() => onGo(element.nextPageId)}>{element.text || t.send}</button>
        <div className="quiz-skip" onClick={() => onGo(element.nextPageId)}>{t.skip}</div>
      </div>
    );
  }
  return (
    <div style={wrap}>
      <div className="quiz-form">
        <input className="quiz-form-input" placeholder={t.formUser} readOnly />
        <input className="quiz-form-input" placeholder={t.email} readOnly />
        <input className="quiz-form-input" placeholder={t.phone} readOnly />
        <label className="quiz-copy" style={{ fontSize: 14 }}><input type="checkbox" readOnly /> {t.privacyAgree}</label>
        <button type="button" className="quiz-cta" style={ctaStyle(element)} onClick={() => onGo(element.nextPageId || "thanks")}>{element.text}</button>
      </div>
    </div>
  );
}
