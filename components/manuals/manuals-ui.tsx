"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { BrandLoader } from "../ui/brand-loader";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { departmentIcon } from "../../lib/manuals/icons";
import { formatHotelDate, readHotelTimeZone } from "../../lib/hotel/clock";
import { getManualsMessages } from "../../lib/i18n/manuals-messages";

type Department = { id: string; name: string };
type Video = { id: string; originalName: string };
type Doc = { id: string; title: string; originalName: string; departmentId: string | null; departmentIds?: string[]; departmentName: string; hotelWide: boolean; updated: string; videos?: Video[] };

const VIDEO_LIMIT = 6;
const VIDEO_BYTES = 50 * 1024 * 1024;

function nameForLocale(names: { en?: string; de?: string; it?: string } | undefined, locale: string, fallback = "") {
  if (!names) return fallback;
  return (locale === "de" ? names.de : locale === "it" ? names.it : names.en) || names.en || names.de || names.it || fallback;
}

function mapSettingsDepartments(payload: unknown, locale: string): Department[] {
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((item) => {
    if (!item || typeof item !== "object" || !("id" in item)) return [];
    const row = item as { id: unknown; names?: { en?: string; de?: string; it?: string }; name?: unknown };
    if (typeof row.id !== "string") return [];
    const name = nameForLocale(row.names, locale, typeof row.name === "string" ? row.name : "");
    return name ? [{ id: row.id, name }] : [];
  });
}

async function loadHotelDepartments(locale: string) {
  const response = await fetch("/api/settings/departments", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error();
  return mapSettingsDepartments(data, locale);
}

function displayTitle(doc: Pick<Doc, "title" | "originalName">) {
  return doc.title.trim() || doc.originalName.replace(/\.(pdf|docx?|txt)$/i, "") || doc.originalName;
}

function canPreviewInPage(doc: Pick<Doc, "originalName">) {
  return /\.(pdf|txt)$/i.test(doc.originalName);
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatHotelDate(date, locale, readHotelTimeZone());
}

function docDepartmentIds(doc: { departmentId: string | null; departmentIds?: string[] }) {
  return doc.departmentIds?.length ? doc.departmentIds : doc.departmentId ? [doc.departmentId] : [];
}

function isVideoFile(file: File) {
  return /\.(mp4|webm|mov)$/i.test(file.name) || file.type === "video/mp4" || file.type === "video/webm" || file.type === "video/quicktime";
}

function addVideoFiles(current: File[], existingCount: number, picked: File[]) {
  const room = VIDEO_LIMIT - existingCount - current.length;
  const accepted: File[] = [];
  let invalid = false;
  let overflow = room <= 0 && picked.some((file) => file.size > 0);
  for (const file of picked) {
    if (file.size <= 0) continue;
    if (file.size > VIDEO_BYTES || !isVideoFile(file)) { invalid = true; continue; }
    if (accepted.length >= room) { overflow = true; continue; }
    accepted.push(file);
  }
  return { files: [...current, ...accepted], invalid, overflow };
}

async function uploadManualVideos(id: string, files: File[], onProgress: (current: number, total: number) => void) {
  for (let index = 0; index < files.length; index += 1) {
    onProgress(index + 1, files.length);
    const body = new FormData();
    body.set("video", files[index]);
    const response = await fetch(`/api/manuals/${id}/videos`, { method: "POST", body });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) return { error: data.error === "TOO_MANY_VIDEOS" ? "TOO_MANY_VIDEOS" as const : "INVALID_VIDEO" as const, uploaded: index };
  }
  return { error: null, uploaded: files.length };
}

function DepartmentPicker({ departments, selectedIds, hotelWideLabel, onHotelWide, onToggle }: { departments: Department[]; selectedIds: string[]; hotelWideLabel: string; onHotelWide: () => void; onToggle: (id: string) => void }) {
  const hotelWide = selectedIds.length === 0;
  return <div className="hb-cat" style={{ marginTop: 8, marginBottom: 0 }}>
    <button type="button" className={`hb-cat-btn${hotelWide ? " active" : ""}`} aria-pressed={hotelWide} onClick={onHotelWide}>{departmentIcon("", true)} {hotelWideLabel}</button>
    {departments.map((department) => {
      const active = selectedIds.includes(department.id);
      return <button type="button" key={department.id} className={`hb-cat-btn${active ? " active" : ""}`} aria-pressed={active} onClick={() => onToggle(department.id)}>{departmentIcon(department.name)} {department.name}</button>;
    })}
  </div>;
}

function VideoField({ label, hint, removeLabel, files, existing, onAdd, onRemoveFile, onRemoveExisting }: { label: string; hint: string; removeLabel: string; files: File[]; existing?: Video[]; onAdd: (files: File[]) => void; onRemoveFile: (index: number) => void; onRemoveExisting?: (id: string) => void }) {
  return <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, display: "grid", gap: 8 }}>
    <div className="field-lbl">{label}</div>
    {existing?.map((video) => <div key={video.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", fontSize: 12.5 }}>
      <span>🎬 {video.originalName}</span>
      {onRemoveExisting ? <button type="button" className="btn btn-ghost" onClick={() => onRemoveExisting(video.id)}>{removeLabel}</button> : null}
    </div>)}
    <input className="field-input" type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" multiple onChange={(event) => { onAdd(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
    <p style={{ fontSize: 12, color: "var(--text3)" }}>{hint}</p>
    {files.map((file, index) => <div key={`${file.name}-${file.size}-${index}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", fontSize: 12.5 }}>
      <span>🎬 {file.name}</span>
      <button type="button" className="btn btn-ghost" onClick={() => onRemoveFile(index)}>{removeLabel}</button>
    </div>)}
  </div>;
}

export function ManualsPage() {
  const { locale } = useI18n();
  const t = getManualsMessages(locale);
  const router = useRouter();
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [notice, setNotice] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Doc | null>(null);
  const [deleting, setDeleting] = useState(false);

  function load() {
    setLoading(true);
    Promise.allSettled([
      fetch(`/api/manuals?locale=${locale}`, { cache: "no-store" }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error();
        return data;
      }),
      loadHotelDepartments(locale),
    ]).then(([manualsResult, departmentsResult]) => {
      if (departmentsResult.status === "fulfilled") setDepartments(departmentsResult.value);
      if (manualsResult.status === "fulfilled") {
        setDocuments(Array.isArray(manualsResult.value.documents) ? manualsResult.value.documents : []);
        setCanManage(Boolean(manualsResult.value.canManage));
      } else setNotice(t.failed);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [locale, t.failed]);

  const rows = useMemo(() => {
    const text = query.trim().toLowerCase();
    return documents.filter((doc) => {
      if (category === "hotel" && !doc.hotelWide) return false;
      if (category !== "all" && category !== "hotel" && !docDepartmentIds(doc).includes(category)) return false;
      if (!text) return true;
      const videos = (doc.videos ?? []).map((video) => video.originalName).join(" ");
      return `${doc.title} ${doc.departmentName} ${videos} ${t.hotelWide}`.toLowerCase().includes(text);
    });
  }, [category, documents, query, t.hotelWide]);

  async function remove() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    const response = await fetch(`/api/manuals?id=${encodeURIComponent(pendingDelete.id)}`, { method: "DELETE" });
    setDeleting(false);
    if (!response.ok) { setNotice(t.failed); return; }
    setDocuments((items) => items.filter((item) => item.id !== pendingDelete.id));
    setPendingDelete(null);
  }

  return <AppShell activeItem="manuals" pageTitle={t.pageTitle}>
    <main className="qf-dashboard pb-24 lg:pb-[24px]">
      <div className="hb-intro">📚 {t.intro}</div>
      <div className="hb-toolbar">
        <input className="hb-search" placeholder={t.search} value={query} onChange={(event) => setQuery(event.target.value)} />
        {canManage ? <button type="button" className="btn btn-primary" onClick={() => router.push("/manuals/new")}>{t.upload}</button> : null}
      </div>
      <div className="hb-cat">
        <div className={`hb-cat-btn${category === "all" ? " active" : ""}`} onClick={() => setCategory("all")}>📚 {t.filterAll}</div>
        {canManage || documents.some((doc) => doc.hotelWide) ? <div className={`hb-cat-btn${category === "hotel" ? " active" : ""}`} onClick={() => setCategory("hotel")}>📚 {t.hotelWide}</div> : null}
        {departments.filter((department) => canManage || documents.some((doc) => docDepartmentIds(doc).includes(department.id))).map((department) => <div key={department.id} className={`hb-cat-btn${category === department.id ? " active" : ""}`} onClick={() => setCategory(department.id)}>{departmentIcon(department.name)} {department.name}</div>)}
      </div>
      {notice ? <p role="status" className="mb-4 rounded-md bg-[var(--qf-accent-soft)] px-3 py-2 text-xs">{notice}</p> : null}
      {rows.length ? rows.map((doc) => {
        const heading = displayTitle(doc);
        return <div key={doc.id} className="hb-item">
          <a className="hb-item-main" href={`/manuals/${doc.id}`} target="_blank" rel="noopener noreferrer">
            <div className="hb-ic">{departmentIcon(doc.departmentName, doc.hotelWide)}</div>
            <div>
              <div className="hb-t">{heading}</div>
              <div className="hb-m">{doc.hotelWide ? t.hotelWide : doc.departmentName} · {t.updated}: {formatDate(doc.updated, locale)}{(doc.videos ?? []).length ? ` · ${t.videos}: ${doc.videos?.length}` : ""}</div>
            </div>
          </a>
          <div className="hb-actions">
            <a className="icon-btn" href={`/api/manuals/${doc.id}/file?download=1`} download={heading} aria-label={t.download} title={t.download}>⬇️</a>
            {canManage ? <Link href={`/manuals/${doc.id}/edit`} className="icon-btn" aria-label={t.edit} title={t.edit}>✏️</Link> : null}
            {canManage ? <button type="button" className="icon-btn danger" aria-label={t.delete} onClick={() => setPendingDelete(doc)}>🗑️</button> : null}
          </div>
        </div>;
      }) : !loading ? <div style={{ fontSize: 12.5, color: "var(--text3)", padding: 12 }}>{t.empty}</div> : null}
      {loading ? <BrandLoader label={t.loading} overlay /> : null}
    </main>
    {pendingDelete ? <ConfirmDialog open title={t.deleteConfirm} message={t.deleteMessage.replace("{title}", displayTitle(pendingDelete))} confirmLabel={t.delete} cancelLabel={t.cancel} pending={deleting} onConfirm={() => void remove()} onCancel={() => { if (!deleting) setPendingDelete(null); }} /> : null}
  </AppShell>;
}

function videoProblem(code: string, t: ReturnType<typeof getManualsMessages>) {
  if (code === "TOO_MANY_VIDEOS") return t.tooManyVideos;
  if (code === "INVALID_VIDEO") return t.invalidVideo;
  return t.failed;
}

export function ManualsUploadPage() {
  const { locale } = useI18n();
  const t = getManualsMessages(locale);
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [videos, setVideos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    loadHotelDepartments(locale).then(setDepartments).catch(() => setNotice(t.failed));
  }, [locale, t.failed]);

  function chooseVideos(picked: File[]) {
    setVideos((current) => {
      const next = addVideoFiles(current, 0, picked);
      if (next.invalid) setNotice(t.invalidVideo);
      else if (next.overflow) setNotice(t.tooManyVideos);
      else setNotice("");
      return next.files;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) { setNotice(t.fileRequired); return; }
    setSaving(true);
    setNotice("");
    const form = new FormData();
    form.set("title", title.trim());
    form.set("scope", departmentIds.length ? "department" : "hotel");
    departmentIds.forEach((id) => form.append("departmentIds", id));
    form.set("file", file);
    const response = await fetch("/api/manuals", { method: "POST", body: form });
    const created = await response.json().catch(() => ({})) as { id?: string };
    if (!response.ok || !created.id) { setSaving(false); setNotice(t.failed); return; }
    const videoResult = await uploadManualVideos(created.id, videos, (current, total) => {
      setNotice(t.uploadingVideo.replace("{current}", String(current)).replace("{total}", String(total)));
    });
    setSaving(false);
    if (videoResult.error) {
      router.push(`/manuals/${created.id}/edit?video=failed`);
      return;
    }
    router.push("/manuals");
  }

  return <AppShell activeItem="manuals" pageTitle={t.uploadTitle}>
    <main className="qf-dashboard pb-24 lg:pb-[24px]">
      <Link href="/manuals" className="back-link">← {t.pageTitle}</Link>
      <form onSubmit={submit} className="card" style={{ maxWidth: 640 }}>
        <div className="ch"><div className="ct">{t.uploadTitle}</div></div>
        <div className="cb" style={{ display: "grid", gap: 16 }}>
          <div>
            <div className="field-lbl">{t.scope}</div>
            <DepartmentPicker departments={departments} selectedIds={departmentIds} hotelWideLabel={t.hotelWide} onHotelWide={() => setDepartmentIds([])} onToggle={(id) => setDepartmentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />
            <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>{t.scopeHint}</p>
          </div>
          <label className="field-lbl">{t.docTitle}
            <input className="field-input" name="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.titlePlaceholder} />
          </label>
          <label className="field-lbl">{t.file}
            <input className="field-input" type="file" accept=".pdf,.doc,.docx,.txt,application/pdf,text/plain" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          {file ? <p style={{ fontSize: 12, color: "var(--text2)" }}>{file.name}</p> : <p style={{ fontSize: 12, color: "var(--text3)" }}>{t.formats}</p>}
          <VideoField label={t.videos} hint={t.videoFormats} removeLabel={t.videoRemove} files={videos} onAdd={chooseVideos} onRemoveFile={(index) => setVideos((current) => current.filter((_, item) => item !== index))} />
          {notice ? <p role="status" style={{ fontSize: 12 }}>{notice}</p> : null}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Link href="/manuals" className="btn btn-ghost">{t.cancel}</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>{t.create}</button>
          </div>
        </div>
      </form>
      {saving ? <BrandLoader label={notice || t.loading} overlay /> : null}
    </main>
  </AppShell>;
}

export function ManualsEditPage({ id }: { id: string }) {
  const { locale } = useI18n();
  const t = getManualsMessages(locale);
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [existingVideos, setExistingVideos] = useState<Video[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [deleted, setDeleted] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const videoFailed = new URLSearchParams(window.location.search).get("video") === "failed";
    Promise.all([
      loadHotelDepartments(locale),
      fetch(`/api/manuals/${id}`, { cache: "no-store" }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error();
        return data.document as { title: string; departmentId: string | null; departmentIds?: string[]; isDeleted: boolean; videos?: Video[] };
      }),
    ]).then(([departmentRows, document]) => {
      setDepartments(departmentRows);
      setTitle(document.title);
      setDepartmentIds(docDepartmentIds(document));
      setExistingVideos(document.videos ?? []);
      setDeleted(document.isDeleted);
      setReady(true);
      if (videoFailed) setNotice(t.invalidVideo);
    }).catch(() => setNotice(t.failed));
  }, [id, locale, t.failed, t.invalidVideo]);

  function chooseVideos(picked: File[]) {
    setVideos((current) => {
      const next = addVideoFiles(current, existingVideos.length, picked);
      if (next.invalid) setNotice(t.invalidVideo);
      else if (next.overflow) setNotice(t.tooManyVideos);
      else setNotice("");
      return next.files;
    });
  }

  async function removeExisting(videoId: string) {
    const response = await fetch(`/api/manuals/${id}/videos?id=${encodeURIComponent(videoId)}`, { method: "DELETE" });
    if (!response.ok) { setNotice(t.failed); return; }
    setExistingVideos((items) => items.filter((item) => item.id !== videoId));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) { setNotice(t.failed); return; }
    setSaving(true);
    setNotice("");
    const response = await fetch(`/api/manuals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), scope: departmentIds.length ? "department" : "hotel", departmentIds }),
    });
    if (!response.ok) { setSaving(false); setNotice(t.failed); return; }
    const videoResult = await uploadManualVideos(id, videos, (current, total) => {
      setNotice(t.uploadingVideo.replace("{current}", String(current)).replace("{total}", String(total)));
    });
    setSaving(false);
    if (videoResult.error) {
      setVideos((current) => current.slice(videoResult.uploaded));
      const fresh = await fetch(`/api/manuals/${id}`, { cache: "no-store" }).then(async (item) => item.ok ? item.json() : null).catch(() => null) as { document?: { videos?: Video[] } } | null;
      if (fresh?.document?.videos) setExistingVideos(fresh.document.videos);
      setNotice(videoProblem(videoResult.error, t));
      return;
    }
    const data = await response.json() as { isDeleted?: boolean };
    router.push(data.isDeleted ? "/settings/recycle-bin" : "/manuals");
  }

  return <AppShell activeItem="manuals" pageTitle={t.editTitle}>
    <main className="qf-dashboard pb-24 lg:pb-[24px]">
      <Link href={deleted ? "/settings/recycle-bin" : "/manuals"} className="back-link">← {deleted ? t.recycleBin : t.pageTitle}</Link>
      <form onSubmit={submit} className="card" style={{ maxWidth: 640 }}>
        <div className="ch"><div className="ct">{t.editTitle}</div></div>
        <div className="cb" style={{ display: "grid", gap: 16 }}>
          {deleted ? <p style={{ fontSize: 12.5, color: "var(--text2)" }}>{t.inBin}</p> : null}
          <div>
            <div className="field-lbl">{t.scope}</div>
            <DepartmentPicker departments={departments} selectedIds={departmentIds} hotelWideLabel={t.hotelWide} onHotelWide={() => setDepartmentIds([])} onToggle={(id) => setDepartmentIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])} />
            <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 8 }}>{t.scopeHint}</p>
          </div>
          <label className="field-lbl">{t.docTitle}
            <input className="field-input" name="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.titlePlaceholder} />
          </label>
          <VideoField label={t.videos} hint={t.videoFormats} removeLabel={t.videoRemove} files={videos} existing={existingVideos} onAdd={chooseVideos} onRemoveFile={(index) => setVideos((current) => current.filter((_, item) => item !== index))} onRemoveExisting={(videoId) => void removeExisting(videoId)} />
          {notice ? <p role="status" style={{ fontSize: 12 }}>{notice}</p> : null}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Link href={deleted ? "/settings/recycle-bin" : "/manuals"} className="btn btn-ghost">{t.cancel}</Link>
            <button type="submit" className="btn btn-primary" disabled={saving || !ready}>{t.save}</button>
          </div>
        </div>
      </form>
      {saving || !ready && !notice ? <BrandLoader label={notice || t.loading} overlay /> : null}
    </main>
  </AppShell>;
}

export function ManualsViewPage({ id }: { id: string }) {
  const { locale } = useI18n();
  const t = getManualsMessages(locale);
  const [doc, setDoc] = useState<Pick<Doc, "id" | "title" | "originalName" | "videos"> | null>(null);
  const [failed, setFailed] = useState(false);
  const heading = doc ? displayTitle(doc) : t.pageTitle;

  useEffect(() => {
    fetch(`/api/manuals?locale=${locale}`, { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error();
      const found = (Array.isArray(data.documents) ? data.documents as Doc[] : []).find((item) => item.id === id);
      if (!found) setFailed(true);
      else setDoc(found);
    }).catch(() => setFailed(true));
  }, [id, locale]);

  useEffect(() => {
    document.title = heading;
  }, [heading]);

  return <AppShell activeItem="manuals" pageTitle={heading}>
    <main className="qf-dashboard hb-view">
      {failed ? <div style={{ padding: 28, fontSize: 12.5, color: "var(--text3)" }}>{t.failed}</div> : null}
      {!failed && !doc ? <BrandLoader label={t.loading} overlay /> : null}
      {doc && canPreviewInPage(doc) ? <iframe className="hb-view-frame" title={heading} src={`/api/manuals/${doc.id}/file`} /> : null}
      {doc && !canPreviewInPage(doc) ? <div style={{ padding: 28, textAlign: "center" }}><a className="btn btn-primary" href={`/api/manuals/${doc.id}/file?download=1`}>{t.download}</a></div> : null}
      {doc?.videos?.length ? <section className="hb-videos">
        <h2>{t.videos}</h2>
        {doc.videos.map((video) => <figure key={video.id}>
          <figcaption className="hb-video-name">{video.originalName}</figcaption>
          <video controls playsInline preload="metadata" src={`/api/manuals/${doc.id}/videos/${video.id}`} />
        </figure>)}
      </section> : null}
    </main>
  </AppShell>;
}
