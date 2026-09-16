"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { BrandLoader } from "../ui/brand-loader";
import { useToast } from "../ui/toast-provider";
import { getNotesMessages, type NotesMessages } from "../../lib/i18n/notes-messages";
import { noteColorFor, type Note, type NoteDept, type NoteFile, type NoteVisibility } from "../../lib/notes/demo-data";
import { useNotes, type HotelDept, type HotelUser } from "./notes-provider";

type T = NotesMessages;
type Filter = "alle" | "aktiv" | "inaktiv";
const MAX_FILES = 10;

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
  const { notes, loading, canManage } = useNotes();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("alle");
  const rows = notes.filter((note) => {
    const statusOk = filter === "alle" || note.status === filter;
    const textOk = !query || `${note.title}${note.desc}`.toLowerCase().includes(query.toLowerCase());
    return statusOk && textOk;
  });

  if (loading) return <Shell title={t.pageTitle}><BrandLoader label={t.loading} /></Shell>;

  return <Shell title={t.pageTitle}>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
      {canManage ? <Link href="/notes/new" className="btn btn-primary">{t.newNote}</Link> : null}
      <input className="field-input" style={{ flex: 1, maxWidth: 320 }} placeholder={t.search} value={query} onChange={(event) => setQuery(event.target.value)} />
      {canManage ? <div className="filter-row" style={{ marginBottom: 0 }}>
        {([["alle", t.filterAll], ["aktiv", t.filterActive], ["inaktiv", t.filterArchived]] as const).map(([id, label]) =>
          <button key={id} type="button" className={`filter-btn${filter === id ? " active" : ""}`} onClick={() => setFilter(id)}>{label}</button>)}
      </div> : null}
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
  const { locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const { notes, templates, departments, users, loading, reload } = useNotes();
  const existing = id ? notes.find((item) => item.id === id) : undefined;
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [template, setTemplate] = useState("");
  const [visibility, setVisibility] = useState<NoteVisibility>("alle");
  const [depts, setDepts] = useState<NoteDept[]>([]);
  const [userIds, setUserIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [kept, setKept] = useState<NoteFile[]>([]);
  const [uploads, setUploads] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(!id);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id || loading) return;
    const note = notes.find((item) => item.id === id);
    if (note) {
      setTitle(note.title);
      setDesc(note.desc);
      setVisibility(note.visibility);
      setDepts(note.depts);
      setUserIds(note.userIds);
      setTags(note.tags);
      setKept(note.attachments);
    }
    setHydrated(true);
  }, [id, notes, loading]);

  function applyTemplate(value: string) {
    setTemplate(value);
    const selected = templates.find((item) => item.id === value);
    if (!selected) return;
    setTitle(selected.title);
    setDesc(selected.desc);
    setTags(selected.tags);
  }

  function addTag() {
    const value = tagInput.trim();
    if (!value) return;
    setTags((current) => current.includes(value) ? current : [...current, value]);
    setTagInput("");
  }

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list);
    setUploads((current) => {
      const next = [...current];
      for (const file of incoming) {
        if (kept.length + next.length >= MAX_FILES) {
          toast({ message: t.maxFiles, tone: "error" });
          break;
        }
        next.push(file);
      }
      return next;
    });
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  }

  async function submit(kind: "note" | "template" | "draft") {
    if (!title.trim()) {
      toast({ message: t.titleRequired, tone: "error" });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("description", desc);
      form.set("tags", JSON.stringify(tags));
      form.set("visibility", visibility);
      form.set("departmentIds", JSON.stringify(depts));
      form.set("userIds", JSON.stringify(userIds));
      form.set("kind", kind === "template" ? "template" : "note");
      form.set("status", kind === "draft" ? "draft" : "aktiv");
      form.set("keepAttachmentIds", JSON.stringify(kept.map((file) => file.id).filter(Boolean)));
      for (const file of uploads) form.append("files", file);
      const url = id && kind === "note" ? `/api/notes/${id}?locale=${locale}` : `/api/notes?locale=${locale}`;
      const response = await fetch(url, { method: id && kind === "note" ? "PATCH" : "POST", body: form });
      const body = await response.json().catch(() => null) as { error?: string; note?: Note } | null;
      if (!response.ok || !body?.note) {
        toast({ message: body?.error === "TITLE_REQUIRED" ? t.titleRequired : t.saveFailed, tone: "error" });
        return;
      }
      await reload();
      if (kind === "template") {
        toast({ message: t.templateSaved, tone: "success" });
        setTemplate(body.note.id);
        return;
      }
      if (kind === "draft") {
        toast({ message: t.draftSaved, tone: "success" });
        return;
      }
      toast({ message: id ? t.savedEdit : t.saved, tone: "success" });
      router.push(`/notes/${body.note.id}`);
    } catch {
      toast({ message: t.saveFailed, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (loading || (id && !hydrated && !existing)) return <Shell title={t.pageTitle}><BrandLoader label={t.loading} /></Shell>;
  if (id && !existing && hydrated && !notes.some((item) => item.id === id) && !loading) {
    return <Shell title={t.pageTitle}><Link href="/notes" className="back-link">{t.back}</Link><p style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.empty}</p></Shell>;
  }

  return <Shell title={t.pageTitle}>
    {busy ? <BrandLoader label={t.loading} overlay /> : null}
    <Link href="/notes" className="back-link">{t.back}</Link>
    <div className="g2">
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch">
            <div className="ct">{t.content}</div>
            <select className="field-select" style={{ maxWidth: 220 }} value={template} onChange={(event) => applyTemplate(event.target.value)}>
              <option value="">{t.chooseTemplate}</option>
              {templates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </div>
          <div className="cb">
            <label className="field-lbl">{t.title}</label>
            <input className="field-input" style={{ marginBottom: 14 }} placeholder={t.titlePlaceholder} value={title} onChange={(event) => setTitle(event.target.value)} />
            <label className="field-lbl">{t.description}</label>
            <textarea className="field-input" style={{ minHeight: 160, resize: "vertical", lineHeight: 1.6 }} placeholder={t.descPlaceholder} value={desc} onChange={(event) => setDesc(event.target.value)} />
            <div style={{ fontSize: 11.5, color: "var(--text3)", margin: "6px 0 16px" }}>{t.autoTranslate}</div>
            <label className="field-lbl">{t.attachment}</label>
            <input ref={fileInput} type="file" multiple hidden accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
            <button type="button" className="dropzone" style={{ marginBottom: 0 }} onClick={() => fileInput.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>{t.dropzone}<br /><span style={{ fontSize: 11 }}>{t.dropHint}</span></button>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 6 }}>{t.fileTypes}</div>
            <div style={{ marginTop: 10 }}>
              {kept.map((file) => <div key={file.id ?? file.name} className="doc-row">
                <div className="doc-ic">📎</div>
                <div className="doc-name">{file.name}</div>
                <button type="button" className="icon-btn danger" onClick={() => setKept((current) => current.filter((item) => item !== file))}>🗑️</button>
              </div>)}
              {uploads.map((file, index) => <div key={`${file.name}-${index}`} className="doc-row">
                <div className="doc-ic">📎</div>
                <div className="doc-name">{file.name}</div>
                <button type="button" className="icon-btn danger" onClick={() => setUploads((current) => current.filter((_, i) => i !== index))}>🗑️</button>
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
            <button type="button" className="btn btn-primary" onClick={() => void submit("note")}>{t.save}</button>
            {!id ? <button type="button" className="btn btn-ghost" onClick={() => void submit("draft")}>{t.saveDraft}</button> : null}
            <button type="button" className="btn btn-ghost" onClick={() => void submit("template")}>{t.saveTemplate}</button>
          </div>
        </div>
      </div>
    </div>
  </Shell>;
}

export function NotesDetailPage({ id }: { id: string }) {
  const t = useT();
  const { locale } = useI18n();
  const toast = useToast();
  const { notes, departments, users, loading, reload, canManage } = useNotes();
  const [note, setNote] = useState<Note | undefined>();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const langName = note?.origLang === "it" ? t.langIt : note?.origLang === "en" ? t.langEn : t.langDe;

  useEffect(() => {
    const found = notes.find((item) => item.id === id);
    if (found) {
      setNote(found);
      return;
    }
    if (loading) return;
    let active = true;
    fetch(`/api/notes/${id}?locale=${locale}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { if (active && data?.note) setNote(data.note as Note); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [id, notes, loading, locale]);

  async function sendComment(event: FormEvent) {
    event.preventDefault();
    const value = comment.trim();
    if (!value || !note || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/notes/${note.id}/comments?locale=${locale}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value }),
      });
      const body = await response.json().catch(() => null) as { note?: Note } | null;
      if (!response.ok || !body?.note) {
        toast({ message: t.commentFailed, tone: "error" });
        return;
      }
      setNote(body.note);
      setComment("");
      await reload();
    } catch {
      toast({ message: t.commentFailed, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus() {
    if (!note || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/notes/${note.id}?locale=${locale}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: note.status === "aktiv" ? "inaktiv" : "aktiv" }),
      });
      const body = await response.json().catch(() => null) as { note?: Note } | null;
      if (response.ok && body?.note) {
        setNote(body.note);
        await reload();
      } else toast({ message: t.saveFailed, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (loading && !note) return <Shell title={t.pageTitle}><BrandLoader label={t.loading} /></Shell>;
  if (!note) {
    return <Shell title={t.pageTitle}><Link href="/notes" className="back-link">{t.back}</Link><p style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.empty}</p></Shell>;
  }

  return <Shell title={t.pageTitle}>
    {busy ? <BrandLoader label={t.loading} overlay /> : null}
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
        {note.origLang && note.origLang !== locale ? <div style={{ display: "flex", fontSize: 11.5, color: "var(--text2)", background: "var(--bg)", borderRadius: 6, padding: "6px 10px", marginBottom: 10, alignItems: "center", justifyContent: "space-between" }}>
          <span>{fill(t.translatedFrom, { lang: langName })}</span>
          <button type="button" style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600, background: "none", border: 0, font: "inherit" }} onClick={() => setShowOriginal((value) => !value)}>{showOriginal ? t.showTranslation : t.showOriginal}</button>
        </div> : null}
        <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: 14 }}>{note.desc}</div>
        <div style={{ marginBottom: 14 }}>
          {note.attachments.map((file) => <a key={file.id ?? file.name} href={file.url} target="_blank" rel="noreferrer" className="doc-row"><div className="doc-ic">📎</div><div className="doc-name">{file.name}</div></a>)}
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
          {note.comments.length ? note.comments.map((item, index) => <div key={item.id ?? `${item.date}-${index}`} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{item.text}</div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{item.author} · {item.date}</div>
          </div>) : <div style={{ fontSize: 12, color: "var(--text3)" }}>{t.noComments}</div>}
        </div>
        <form style={{ display: "flex", gap: 8 }} onSubmit={sendComment}>
          <input className="field-input" placeholder={t.commentPlaceholder} value={comment} onChange={(event) => setComment(event.target.value)} />
          <button type="submit" className="btn btn-ghost">{t.add}</button>
        </form>
      </div>
      {canManage ? <div className="cb" style={{ borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={() => void toggleStatus()}>{note.status === "aktiv" ? t.markInactive : t.markActive}</button>
        <Link href={`/notes/${note.id}/edit`} className="btn btn-ghost">{t.edit}</Link>
      </div> : null}
    </div>
  </Shell>;
}
