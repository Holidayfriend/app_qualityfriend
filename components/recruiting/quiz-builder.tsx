"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import type { RecruitingMessages } from "../../lib/i18n/recruiting-messages";

type T = RecruitingMessages;

export const QUIZ_IMAGE_PLACEHOLDER = "/recruiting/image-placeholder.png";
export const QUIZ_FUNNEL1 = "/recruiting/funnel1.png";
export const QUIZ_FUNNEL2 = "/recruiting/funnel2.png";
export const QUIZ_DUMMY = "/recruiting/dummy.png";
export const QUIZ_VOICE_AVATAR = "/recruiting/colleagues3.png";
export const QUIZ_VOICE_SAMPLE = "/recruiting/voice-sample.mp3";

export type QuizElementType =
  | "text" | "text_small" | "text_header" | "icons" | "button" | "image" | "audio"
  | "spacers" | "video" | "single" | "multi" | "area" | "file" | "form";

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
};

export type QuizPage = {
  id: string;
  name: string;
  locked?: boolean;
  elements: QuizElement[];
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
];

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
        hdr(t.q1Prompt),
        single([opt(t.yesHave, "👍", "q2"), opt(t.noHavent, "👎", "disqualify")]),
      ],
    },
    {
      id: "q2",
      name: t.pageQ2,
      elements: [
        body(t.multiHint, 14),
        hdr(t.q2Prompt),
        multi([opt(t.optStable, "🛡️"), opt(t.optHours, "⏰"), opt(t.optLearn, "📚")]),
        btn(t.toNextQuestion, "q3"),
      ],
    },
    {
      id: "q3",
      name: t.pageQ3,
      elements: [
        hdr(t.q3Prompt),
        single([
          opt(t.exp1, "🌱", "q4"),
          opt(t.exp13, "🌿", "q4"),
          opt(t.exp35, "🌳", "q4"),
          opt(t.exp5, "⭐", "q4"),
        ]),
      ],
    },
    {
      id: "q4",
      name: t.pageQ4,
      elements: [
        voice(),
        body(t.doneIt),
        hdr(t.q4Prompt),
        createElement("area", t),
        btn(t.toNextQuestion, "q5"),
      ],
    },
    {
      id: "q5",
      name: t.pageQ5,
      elements: [
        hdr(t.q5Prompt),
        single([
          opt(t.startAnytime, "🚀", "q6"),
          opt(t.start2weeks, "📅", "q6"),
          opt(t.start1month, "🗓️", "q6"),
          opt(t.startLater, "⏳", "q6"),
        ]),
      ],
    },
    {
      id: "q6",
      name: t.pageQ6,
      elements: [
        hdr(t.q6Prompt),
        { ...createElement("file", t, "q7"), nextPageId: "q7" },
        body(t.cvSafeNote),
      ],
    },
    {
      id: "q7",
      name: t.pageQ7,
      elements: [
        body(t.q7Intro),
        hdr(t.q7Prompt),
        single([
          opt(t.time1012, "🕙", "data"),
          opt(t.time1214, "🕛", "data"),
          opt(t.time1418, "🕓", "data"),
          opt(t.timeEvening, "🌙", "data"),
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
  ];
}

type BuilderProps = {
  t: T;
  pages: QuizPage[];
  setPages: (pages: QuizPage[]) => void;
  activePageId: string;
  setActivePageId: (id: string) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
};

export function QuizToolsCard(props: BuilderProps) {
  const { t, pages, setPages, activePageId, setActivePageId, selectedId, setSelectedId } = props;
  const [tab, setTab] = useState<"ideas" | "elements">("elements");
  const page = pages.find((item) => item.id === activePageId) ?? pages[0];
  const selected = page?.elements.find((item) => item.id === selectedId) ?? null;
  useEffect(() => {
    if (selectedId) setTab("ideas");
  }, [selectedId]);

  function renamePage(id: string, name: string) {
    setPages(pages.map((item) => item.id === id ? { ...item, name } : item));
  }
  function addPage() {
    const id = uid("page");
    setPages([...pages.filter((item) => !item.locked), { id, name: t.newPage, elements: [createElement("text_header", t)] }, ...pages.filter((item) => item.locked)]);
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
  function patchElement(patch: Partial<QuizElement>) {
    if (!selected) return;
    setPages(pages.map((item) => item.id !== page.id ? item : {
      ...item,
      elements: item.elements.map((el) => el.id === selected.id ? { ...el, ...patch } : el),
    }));
  }

  return (
    <div className="card">
      <div className="ch"><div className="ct">{t.pagesStep}</div></div>
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="quiz-pages">
          {pages.filter((item) => !item.locked).map((item) => (
            <div key={item.id} className={`quiz-page ${item.id === activePageId ? "active" : ""}`}>
              <button type="button" className="quiz-page-btn" onClick={() => { setActivePageId(item.id); setSelectedId(null); setTab("elements"); }}>
                <input className="quiz-page-name" value={item.name} onChange={(event) => renamePage(item.id, event.target.value)} onClick={(event) => event.stopPropagation()} />
              </button>
              <button type="button" className="icon-btn danger" onClick={() => removePage(item.id)}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" style={{ width: "100%" }} onClick={addPage}>{t.addPage}</button>
          <div className="quiz-fixed-label">{t.fixedPages}</div>
          {pages.filter((item) => item.locked).map((item) => (
            <div key={item.id} className={`quiz-page locked ${item.id === activePageId ? "active" : ""}`}>
              <button type="button" className="quiz-page-btn" onClick={() => { setActivePageId(item.id); setSelectedId(null); setTab("elements"); }}>
                <span className="quiz-page-name" style={{ cursor: "pointer" }}>{item.name}</span>
              </button>
            </div>
          ))}
        </div>
        <div className="bud-tab-row" style={{ borderBottom: "1px solid var(--border)" }}>
          <button type="button" className={`bud-tab ${tab === "ideas" ? "active" : ""}`} onClick={() => setTab("ideas")}>{t.ideasTab}</button>
          <button type="button" className={`bud-tab ${tab === "elements" ? "active" : ""}`} onClick={() => setTab("elements")}>{t.elementsTab}</button>
        </div>
        {tab === "elements" ? (
          <div className="quiz-el-grid">
            {PALETTE.map((item) => (
              <button
                key={item.type}
                type="button"
                className="quiz-el"
                draggable
                onDragStart={(event) => { event.dataTransfer.setData("application/x-quiz-el", item.type); event.dataTransfer.effectAllowed = "copy"; }}
              >
                <span className="quiz-el-ic">{item.icon}</span>
                <span>{item.label(t)}</span>
              </button>
            ))}
          </div>
        ) : selected ? (
          <IdeasForm t={t} pages={pages} element={selected} onChange={patchElement} />
        ) : (
          <div style={{ fontSize: 12.5, color: "var(--text3)", padding: "8px 0" }}>{t.ideasEmpty}</div>
        )}
      </div>
    </div>
  );
}

function IdeasForm({ t, pages, element, onChange }: { t: T; pages: QuizPage[]; element: QuizElement; onChange: (patch: Partial<QuizElement>) => void }) {
  const imageRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const textTypes = element.type === "text" || element.type === "text_small" || element.type === "text_header" || element.type === "button" || element.type === "file" || element.type === "form";
  const pageOptions = pages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>);

  function pickFile(input: HTMLInputElement | null, field: "src" | "avatarSrc") {
    const file = input?.files?.[0];
    if (!file) return;
    onChange({ [field]: URL.createObjectURL(file) });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {textTypes ? (
        <label><span className="field-lbl">{t.elText}</span>
          <input className="field-input" value={element.text} onChange={(event) => onChange({ text: event.target.value })} />
        </label>
      ) : null}
      {element.type === "text" || element.type === "text_small" || element.type === "text_header" || element.type === "icons" ? (
        <label><span className="field-lbl">{t.fontSize}</span>
          <input className="field-input" type="number" min={10} max={48} value={element.fontSize} onChange={(event) => onChange({ fontSize: Number(event.target.value) || 14 })} />
        </label>
      ) : null}
      {element.type === "icons" ? (
        <label><span className="field-lbl">{t.elIcons}</span>
          <input className="field-input" value={element.icon} onChange={(event) => onChange({ icon: event.target.value })} />
        </label>
      ) : null}
      {element.type !== "spacers" && element.type !== "form" && element.type !== "file" && element.type !== "single" && element.type !== "multi" ? (
        <label><span className="field-lbl">{t.align}</span>
          <select className="field-select" value={element.align} onChange={(event) => onChange({ align: event.target.value as QuizElement["align"] })}>
            <option value="left">{t.alignLeft}</option>
            <option value="center">{t.alignCenter}</option>
            <option value="right">{t.alignRight}</option>
          </select>
        </label>
      ) : null}
      {element.type === "image" ? (
        <div>
          <span className="field-lbl">{t.replaceImage}</span>
          <input ref={imageRef} type="file" accept="image/*" hidden onChange={() => pickFile(imageRef.current, "src")} />
          <button type="button" className="dropzone" style={{ marginBottom: 0, padding: 16 }} onClick={() => imageRef.current?.click()}>{t.replaceImage}<br /><span style={{ fontSize: 11 }}>{t.dropOrClick}</span></button>
        </div>
      ) : null}
      {element.type === "audio" ? (
        <>
          <div>
            <span className="field-lbl">{t.replaceAvatar}</span>
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={() => pickFile(avatarRef.current, "avatarSrc")} />
            <button type="button" className="dropzone" style={{ marginBottom: 0, padding: 16 }} onClick={() => avatarRef.current?.click()}>{t.replaceAvatar}</button>
          </div>
          <div>
            <span className="field-lbl">{t.replaceVoice}</span>
            <input ref={voiceRef} type="file" accept="audio/*" hidden onChange={() => pickFile(voiceRef.current, "src")} />
            <button type="button" className="dropzone" style={{ marginBottom: 0, padding: 16 }} onClick={() => voiceRef.current?.click()}>{t.replaceVoice}</button>
          </div>
        </>
      ) : null}
      {element.type === "video" ? (
        <label><span className="field-lbl">{t.videoUrl}</span>
          <input className="field-input" value={element.src} onChange={(event) => onChange({ src: event.target.value })} />
        </label>
      ) : null}
      {element.type === "area" ? (
        <label><span className="field-lbl">{t.elArea}</span>
          <input className="field-input" value={element.placeholder} onChange={(event) => onChange({ placeholder: event.target.value })} />
        </label>
      ) : null}
      {(element.type === "button" || element.type === "file" || element.type === "form") ? (
        <label><span className="field-lbl">{t.nextPage}</span>
          <select className="field-select" value={element.nextPageId} onChange={(event) => onChange({ nextPageId: event.target.value })}>
            <option value="">{t.choosePage}</option>
            {pageOptions}
          </select>
        </label>
      ) : null}
      {(element.type === "single" || element.type === "multi") ? (
        <div>
          <span className="field-lbl">{t.elSingle}</span>
          {element.options.map((option, index) => (
            <div key={option.id} className="quiz-opt-edit">
              <input className="field-input" value={option.icon} style={{ maxWidth: 48 }} onChange={(event) => onChange({ options: element.options.map((row, i) => i === index ? { ...row, icon: event.target.value } : row) })} />
              <input className="field-input" value={option.label} onChange={(event) => onChange({ options: element.options.map((row, i) => i === index ? { ...row, label: event.target.value } : row) })} />
              {element.type === "single" ? (
                <select className="field-select" value={option.nextPageId} onChange={(event) => onChange({ options: element.options.map((row, i) => i === index ? { ...row, nextPageId: event.target.value } : row) })}>
                  <option value="">{t.nextPage}</option>
                  {pageOptions}
                </select>
              ) : null}
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={() => onChange({ options: [...element.options, { id: uid("opt"), label: t.newOption, icon: "➕", nextPageId: "" }] })}>{t.addOption}</button>
        </div>
      ) : null}
    </div>
  );
}

export function QuizCanvasCard({ t, pages, setPages, activePageId, setActivePageId, selectedId, setSelectedId, onPublish, onDraft }: BuilderProps & { onPublish: () => void; onDraft: () => void }) {
  const [dropAt, setDropAt] = useState<number | null>(null);
  const page = pages.find((item) => item.id === activePageId) ?? pages[0];
  const pageIndex = pages.findIndex((item) => item.id === page?.id);

  function updateElements(elements: QuizElement[]) {
    setPages(pages.map((item) => item.id === page.id ? { ...item, elements } : item));
  }
  function insertAt(index: number, type: QuizElementType) {
    const nextId = pages[pageIndex + 1]?.id ?? "";
    const next = [...page.elements];
    next.splice(index, 0, createElement(type, t, nextId));
    updateElements(next);
  }
  function onDropCanvas(event: DragEvent, index: number) {
    event.preventDefault();
    setDropAt(null);
    const type = event.dataTransfer.getData("application/x-quiz-el") as QuizElementType;
    const moveId = event.dataTransfer.getData("application/x-quiz-move");
    if (moveId) {
      const from = page.elements.findIndex((item) => item.id === moveId);
      if (from < 0) return;
      const next = [...page.elements];
      const [moved] = next.splice(from, 1);
      next.splice(from < index ? index - 1 : index, 0, moved);
      updateElements(next);
      return;
    }
    if (type) insertAt(index, type);
  }
  function removeElement(id: string) {
    updateElements(page.elements.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId(null);
  }
  function go(nextId: string) {
    if (!nextId) return;
    if (pages.some((item) => item.id === nextId)) {
      setActivePageId(nextId);
      setSelectedId(null);
    }
  }

  return (
    <div className="card">
      <div className="ch" style={{ flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
        <div className="ct">{t.quizCanvas}</div>
        <div style={{ fontSize: 12, color: "var(--text2)" }}>{page.name} · {t.dropHint}</div>
      </div>
      <div className="cb">
        <div className="quiz-phone">
          <div className="quiz-phone-bar" />
          <div
            className="quiz-canvas"
            onDragOver={(event) => { event.preventDefault(); if (page.elements.length === 0) setDropAt(0); }}
            onDrop={(event) => onDropCanvas(event, page.elements.length)}
            onDragLeave={() => setDropAt(null)}
          >
            {page.elements.length === 0 ? <div className="quiz-empty">{t.dropHint}</div> : null}
            {page.elements.map((element, index) => (
              <div key={element.id}>
                <div
                  className={`quiz-insert ${dropAt === index ? "show" : ""}`}
                  onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setDropAt(index); }}
                  onDrop={(event) => { event.stopPropagation(); onDropCanvas(event, index); }}
                />
                <div
                  className={`quiz-block ${selectedId === element.id ? "selected" : ""}`}
                  draggable
                  onDragStart={(event) => { event.dataTransfer.setData("application/x-quiz-move", element.id); event.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setDropAt(index + 1); }}
                  onDrop={(event) => { event.stopPropagation(); onDropCanvas(event, index + 1); }}
                  onClick={() => setSelectedId(element.id)}
                >
                  <button type="button" className="quiz-del" onClick={(event) => { event.stopPropagation(); removeElement(element.id); }}>✕</button>
                  <QuizBlock t={t} element={element} onGo={go} />
                </div>
              </div>
            ))}
            {page.elements.length ? (
              <div
                className={`quiz-insert ${dropAt === page.elements.length ? "show" : ""}`}
                onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); setDropAt(page.elements.length); }}
                onDrop={(event) => { event.stopPropagation(); onDropCanvas(event, page.elements.length); }}
              />
            ) : null}
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

function QuizBlock({ t, element, onGo }: { t: T; element: QuizElement; onGo: (id: string) => void }) {
  const align = { textAlign: element.align } as const;
  if (element.type === "text" || element.type === "text_small" || element.type === "text_header") {
    return <div style={{ ...align, fontSize: element.fontSize, fontWeight: element.type === "text_header" ? 700 : 400, lineHeight: 1.45 }}>{element.text}</div>;
  }
  if (element.type === "icons") return <div style={{ ...align, fontSize: element.fontSize }}>{element.icon}</div>;
  if (element.type === "button") {
    return <div style={align}><button type="button" className="btn btn-primary" onClick={() => onGo(element.nextPageId)}>{element.text}</button></div>;
  }
  if (element.type === "image") {
    return <div style={align}><img src={element.src || QUIZ_IMAGE_PLACEHOLDER} alt="" className="quiz-img" /></div>;
  }
  if (element.type === "audio") {
    return (
      <div className="quiz-voice">
        <img src={element.avatarSrc || QUIZ_VOICE_AVATAR} alt="" className="quiz-avatar" />
        <audio controls src={element.src || QUIZ_VOICE_SAMPLE} />
      </div>
    );
  }
  if (element.type === "spacers") return <div className="quiz-spacer" />;
  if (element.type === "video") {
    const src = element.src.includes("player.vimeo.com") || element.src.includes("youtube") ? element.src : `https://www.youtube.com/embed/${element.src}`;
    return <div className="quiz-video"><iframe title="video" src={src} allow="fullscreen" /></div>;
  }
  if (element.type === "single" || element.type === "multi") {
    return (
      <div className="quiz-choices">
        {element.options.map((option) => (
          <button key={option.id} type="button" className="quiz-choice" onClick={() => element.type === "single" && onGo(option.nextPageId)}>
            {element.type === "multi" ? <input type="checkbox" readOnly /> : <span>›</span>}
            <span style={{ flex: 1, textAlign: "left" }}>{option.label}</span>
            <span>{option.icon}</span>
          </button>
        ))}
      </div>
    );
  }
  if (element.type === "area") {
    return <textarea className="field-input" rows={4} placeholder={element.placeholder} readOnly />;
  }
  if (element.type === "file") {
    return (
      <div style={{ textAlign: "center" }}>
        <div className="dropzone" style={{ marginBottom: 10 }}>{t.clickOrDropFile}</div>
        <button type="button" className="btn btn-primary" onClick={() => onGo(element.nextPageId)}>{element.text || t.send}</button>
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--text3)", cursor: "pointer" }} onClick={() => onGo(element.nextPageId)}>{t.skip}</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <input className="field-input" placeholder={t.formUser} readOnly />
      <input className="field-input" placeholder={t.email} readOnly />
      <input className="field-input" placeholder={t.phone} readOnly />
      <label style={{ fontSize: 12, color: "var(--text2)" }}><input type="checkbox" readOnly /> {t.privacyAgree}</label>
      <button type="button" className="btn btn-primary" onClick={() => onGo(element.nextPageId || "thanks")}>{element.text}</button>
    </div>
  );
}
