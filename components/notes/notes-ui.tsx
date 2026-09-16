"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { getNotesMessages, type NotesMessages } from "../../lib/i18n/notes-messages";
import { noteColorFor, type Note, type NoteDept, type NoteFile, type NoteVisibility } from "../../lib/notes/demo-data";
import { useNotes, type HotelDept, type HotelUser } from "./notes-provider";

type T = NotesMessages;
type Filter = "alle" | "aktiv" | "inaktiv";

function useT() {
  const { locale } = useI18n();
  return getNotesMessages(locale);
}

function fill(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function deptLabel(id: string, departments: HotelDept[], t: T) {
  const fromDb = departments.find((item) => item.id === id);
  if (fromDb) return fromDb.name;
  return t.depts[id as keyof T["depts"]] ?? id;
}

function userLabel(id: string, users: HotelUser[]) {
  return users.find((item) => item.id === id)?.name ?? id;
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return <AppShell activeItem="notes" pageTitle={title}><main className="qf-dashboard pb-24 lg:pb-[24px]">{children}</main></AppShell>;
}

export function NotesListPage() {
  const t = useT();
  const { notes } = useNotes();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("alle");
  const rows = notes.filter((note) => {
    const statusOk = filter === "alle" || note.status === filter;
    const textOk = !query || `${note.title}${note.desc}`.toLowerCase().includes(query.toLowerCase());
    return statusOk && textOk;
  });

  return <Shell title={t.pageTitle}>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
      <Link href="/notes/new" className="btn btn-primary">{t.newNote}</Link>
      <input className="field-input" style={{ flex: 1, maxWidth: 320 }} placeholder={t.search} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="filter-row" style={{ marginBottom: 0 }}>
        {([["alle", t.filterAll], ["aktiv", t.filterActive], ["inaktiv", t.filterArchived]] as const).map(([id, label]) =>
          <button key={id} type="button" className={`filter-btn${filter === id ? " active" : ""}`} onClick={() => setFilter(id)}>{label}</button>)}
      </div>
    </div>
    <div className="note-grid">
      {rows.length ? rows.map((note) => <Link key={note.id} href={`/notes/${note.id}`} className="note-card" style={{ background: noteColorFor(note), opacity: note.status === "inaktiv" ? 0.55 : 1 }}>
        {note.visibility === "privat" ? <div style={{ position: "absolute", top: 10, right: 12, fontSize: 14 }}>🔒</div> : null}
        <div className="note-title">{note.title}</div>
        <div className="note-body">{note.desc.split("\n")[0].slice(0, 140)}</div>
        <div className="note-meta">{note.creator} · {note.date}</div>
      </Link>) : <div style={{ fontSize: 12.5, color: "var(--text3)", gridColumn: "1 / -1" }}>{t.empty}</div>}
    </div>
  </Shell>;
}

export function NotesFormPage({ id }: { id?: string }) {
  const t = useT();
  const router = useRouter();
  const { notes, fullName, departments, users, upsert } = useNotes();
  const existing = id ? notes.find((item) => item.id === id) : undefined;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [desc, setDesc] = useState(existing?.desc ?? "");
  const [template, setTemplate] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>(existing?.visibility ?? "alle");
  const [depts, setDepts] = useState<NoteDept[]>(existing?.depts ?? []);
  const [userIds, setUserIds] = useState<string[]>(existing?.userIds ?? []);
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [attachments, setAttachments] = useState<NoteFile[]>(existing?.attachments ?? []);

  function applyTemplate(value: string) {
    setTemplate(value);
  }

  function addTag() {
    const value = tagInput.trim();
    if (!value) return;
    setTags((current) => [...current, value]);
    setTagInput("");
  }

  function addAttachment() {
    const name = window.prompt(t.filePrompt, t.filePromptValue);
    if (!name) return;
    setAttachments((current) => [...current, { name }]);
  }

  function save() {
    if (!title.trim()) {
      window.alert(t.titleRequired);
      return;
    }
    const note: Note = {
      id: existing?.id ?? `note_${Date.now()}`,
      title: title.trim(),
      creator: existing?.creator ?? (fullName.split(" ")[0] || "Klaus"),
      date: existing?.date ?? new Date().toLocaleDateString("de-DE"),
      status: existing?.status ?? "aktiv",
      visibility,
      depts: visibility === "dept" ? depts : [],
      userIds: visibility === "user" ? userIds : [],
      tags,
      origLang: existing?.origLang ?? "de",
      desc,
      attachments,
      comments: existing?.comments ?? [],
    };
    upsert(note);
    window.alert(existing ? t.savedEdit : t.saved);
    router.push("/notes");
  }

  return <Shell title={t.pageTitle}>
    <Link href="/notes" className="back-link">{t.back}</Link>
    <div className="g2">
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch">
            <div className="ct">{t.content}</div>
            <select className="field-select" style={{ maxWidth: 220 }} value={template} onChange={(event) => applyTemplate(event.target.value)}>
              <option value="">{t.chooseTemplate}</option>
              <option value="guest">{t.tplGuest}</option>
              <option value="supplier">{t.tplSupplier}</option>
              <option value="project">{t.tplProject}</option>
            </select>
          </div>
          <div className="cb">
            <label className="field-lbl">{t.title}</label>
            <input className="field-input" style={{ marginBottom: 14 }} placeholder={t.titlePlaceholder} value={title} onChange={(event) => setTitle(event.target.value)} />
            <label className="field-lbl">{t.description}</label>
            <textarea className="field-input" style={{ minHeight: 160, resize: "vertical", lineHeight: 1.6 }} placeholder={t.descPlaceholder} value={desc} onChange={(event) => setDesc(event.target.value)} />
            <div style={{ fontSize: 11.5, color: "var(--text3)", margin: "6px 0 16px" }}>{t.autoTranslate}</div>
            <label className="field-lbl">{t.attachment}</label>
            <button type="button" className="dropzone" style={{ marginBottom: 0 }} onClick={addAttachment}>{t.dropzone}<br /><span style={{ fontSize: 11 }}>{t.dropHint}</span></button>
            <div style={{ marginTop: 10 }}>
              {attachments.map((file, index) => <div key={`${file.name}-${index}`} className="doc-row">
                <div className="doc-ic">📎</div>
                <div className="doc-name">{file.name}</div>
                <button type="button" className="icon-btn danger" onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}>🗑️</button>
              </div>)}
            </div>
          </div>
        </div>
      </div>
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><div className="ct">{t.visibility}</div></div>
          <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="radio" name="note-vis" checked={visibility === "alle"} onChange={() => setVisibility("alle")} /> {t.visAll}</label>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="radio" name="note-vis" checked={visibility === "dept"} onChange={() => setVisibility("dept")} /> {t.visDept}</label>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="radio" name="note-vis" checked={visibility === "user"} onChange={() => setVisibility("user")} /> {t.visUser}</label>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="radio" name="note-vis" checked={visibility === "privat"} onChange={() => setVisibility("privat")} /> {t.visPrivate}</label>
            <div style={{ fontSize: 11, color: "var(--text3)", marginLeft: 24, marginTop: -4 }}>{t.visPrivateHint}</div>
            {visibility === "dept" ? <div style={{ marginTop: 6 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {depts.map((dept, index) => <span key={dept} className="chip chip-n">{deptLabel(dept, departments, t)} <span style={{ cursor: "pointer", marginLeft: 4 }} onClick={() => setDepts((current) => current.filter((_, i) => i !== index))}>✕</span></span>)}
              </div>
              <select className="field-select" defaultValue="" onChange={(event) => { const value = event.target.value; if (value && !depts.includes(value)) setDepts((current) => [...current, value]); event.target.value = ""; }}>
                <option value="">{t.addDept}</option>
                {departments.filter((dept) => !depts.includes(dept.id)).map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
              </select>
            </div> : null}
            {visibility === "user" ? <div style={{ marginTop: 6 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                {userIds.map((userId, index) => <span key={userId} className="chip chip-n">{userLabel(userId, users)} <span style={{ cursor: "pointer", marginLeft: 4 }} onClick={() => setUserIds((current) => current.filter((_, i) => i !== index))}>✕</span></span>)}
              </div>
              <select className="field-select" defaultValue="" onChange={(event) => { const value = event.target.value; if (value && !userIds.includes(value)) setUserIds((current) => [...current, value]); event.target.value = ""; }}>
                <option value="">{t.addUser}</option>
                {users.filter((user) => !userIds.includes(user.id)).map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
              </select>
            </div> : null}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><div className="ct">{t.tags}</div></div>
          <div className="cb">
            <input className="field-input" placeholder={t.tagPlaceholder} value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {tags.map((tag, index) => <span key={`${tag}-${index}`} className="chip chip-b">{tag} <span style={{ cursor: "pointer", marginLeft: 4 }} onClick={() => setTags((current) => current.filter((_, i) => i !== index))}>✕</span></span>)}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="button" className="btn btn-primary" onClick={save}>{t.save}</button>
            <button type="button" className="btn btn-ghost" onClick={() => window.alert(t.draftSaved)}>{t.saveDraft}</button>
            <button type="button" className="btn btn-ghost" onClick={() => window.alert(t.templateSaved)}>{t.saveTemplate}</button>
          </div>
        </div>
      </div>
    </div>
  </Shell>;
}

export function NotesDetailPage({ id }: { id: string }) {
  const t = useT();
  const { notes, departments, users, toggleStatus, addComment } = useNotes();
  const note = notes.find((item) => item.id === id);
  const [comment, setComment] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const langName = note?.origLang === "it" ? t.langIt : note?.origLang === "en" ? t.langEn : t.langDe;

  if (!note) {
    return <Shell title={t.pageTitle}><Link href="/notes" className="back-link">{t.back}</Link><p style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.empty}</p></Shell>;
  }

  function sendComment(event: FormEvent) {
    event.preventDefault();
    const value = comment.trim();
    if (!value) return;
    addComment(note.id, value);
    setComment("");
  }

  return <Shell title={t.pageTitle}>
    <Link href="/notes" className="back-link">{t.back}</Link>
    <div className="card">
      <div className="ch">
        <div>
          <div className="ct">{note.title}</div>
          <div style={{ fontSize: 11.5, color: "var(--text2)", fontWeight: 400, marginTop: 2 }}>{note.creator} · {note.date}</div>
        </div>
        <span className={`status-pill ${note.status === "aktiv" ? "active" : "inactive"}`}>{note.status === "aktiv" ? t.statusActive : t.statusArchived}</span>
      </div>
      <div className="cb">
        {note.origLang !== "de" ? <div style={{ display: "flex", fontSize: 11.5, color: "var(--text2)", background: "var(--bg)", borderRadius: 6, padding: "6px 10px", marginBottom: 10, alignItems: "center", justifyContent: "space-between" }}>
          <span>{fill(t.translatedFrom, { lang: langName })}</span>
          <button type="button" style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600, background: "none", border: 0, font: "inherit" }} onClick={() => setShowOriginal((value) => !value)}>{showOriginal ? t.showTranslation : t.showOriginal}</button>
        </div> : null}
        <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: 14 }}>{note.desc}</div>
        <div style={{ marginBottom: 14 }}>
          {note.attachments.map((file, index) => <div key={`${file.name}-${index}`} className="doc-row"><div className="doc-ic">📎</div><div className="doc-name">{file.name}</div></div>)}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {note.visibility === "user" && note.userIds.length ? note.userIds.map((userId) => <span key={userId} className="chip chip-n">{userLabel(userId, users)}</span>)
            : note.depts.length ? note.depts.map((dept) => <span key={dept} className="chip chip-n">{deptLabel(dept, departments, t)}</span>)
            : note.visibility === "privat" ? <span className="chip chip-r">{t.privateChip}</span>
            : <span className="chip chip-n">{t.visibleAll}</span>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {note.tags.map((tag) => <span key={tag} className="chip chip-b">{tag}</span>)}
        </div>
      </div>
      <div className="cb" style={{ borderTop: "1px solid var(--border)" }}>
        <label className="field-lbl" style={{ marginBottom: 6 }}>{t.comments}</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {note.comments.length ? note.comments.map((item, index) => <div key={`${item.date}-${index}`} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{item.text}</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{item.author} · {item.date}</div>
          </div>) : <div style={{ fontSize: 12, color: "var(--text3)" }}>{t.noComments}</div>}
        </div>
        <form style={{ display: "flex", gap: 8 }} onSubmit={sendComment}>
          <input className="field-input" placeholder={t.commentPlaceholder} value={comment} onChange={(event) => setComment(event.target.value)} />
          <button type="submit" className="btn btn-ghost">{t.add}</button>
        </form>
      </div>
      <div className="cb" style={{ borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={() => toggleStatus(note.id)}>{note.status === "aktiv" ? t.markInactive : t.markActive}</button>
        <Link href={`/notes/${note.id}/edit`} className="btn btn-ghost">{t.edit}</Link>
      </div>
    </div>
  </Shell>;
}
