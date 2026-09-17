"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { BrandLoader } from "../ui/brand-loader";
import { departmentIcon } from "../../lib/manuals/icons";
import { getManualsMessages } from "../../lib/i18n/manuals-messages";

type Department = { id: string; name: string };
type Doc = { id: string; title: string; originalName: string; departmentId: string | null; departmentName: string; hotelWide: boolean; updated: string };

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
  return date.toLocaleDateString(locale === "de" ? "de-DE" : locale === "it" ? "it-IT" : "en-GB");
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
      if (category !== "all" && category !== "hotel" && doc.departmentId !== category) return false;
      if (!text) return true;
      return `${doc.title} ${doc.departmentName} ${t.hotelWide}`.toLowerCase().includes(text);
    });
  }, [category, documents, query, t.hotelWide]);

  async function remove(doc: Doc) {
    if (!window.confirm(t.deleteConfirm)) return;
    const response = await fetch(`/api/manuals?id=${encodeURIComponent(doc.id)}`, { method: "DELETE" });
    if (!response.ok) { setNotice(t.failed); return; }
    setDocuments((items) => items.filter((item) => item.id !== doc.id));
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
        {departments.filter((department) => canManage || documents.some((doc) => doc.departmentId === department.id)).map((department) => <div key={department.id} className={`hb-cat-btn${category === department.id ? " active" : ""}`} onClick={() => setCategory(department.id)}>{departmentIcon(department.name)} {department.name}</div>)}
      </div>
      {notice ? <p role="status" className="mb-4 rounded-md bg-[var(--qf-accent-soft)] px-3 py-2 text-xs">{notice}</p> : null}
      {rows.length ? rows.map((doc) => {
        const heading = displayTitle(doc);
        return <div key={doc.id} className="hb-item">
          <a className="hb-item-main" href={`/manuals/${doc.id}`} target="_blank" rel="noopener noreferrer">
            <div className="hb-ic">{departmentIcon(doc.departmentName, doc.hotelWide)}</div>
            <div>
              <div className="hb-t">{heading}</div>
              <div className="hb-m">{doc.hotelWide ? t.hotelWide : doc.departmentName} · {t.updated}: {formatDate(doc.updated, locale)}</div>
            </div>
          </a>
          <div className="hb-actions">
            <a className="icon-btn" href={`/api/manuals/${doc.id}/file?download=1`} download={heading} aria-label={t.download} title={t.download}>⬇️</a>
            {canManage ? <button type="button" className="icon-btn danger" aria-label={t.delete} onClick={() => { void remove(doc); }}>🗑️</button> : null}
          </div>
        </div>;
      }) : !loading ? <div style={{ fontSize: 12.5, color: "var(--text3)", padding: 12 }}>{t.empty}</div> : null}
      {loading ? <BrandLoader label={t.loading} overlay /> : null}
    </main>
  </AppShell>;
}

export function ManualsUploadPage() {
  const { locale } = useI18n();
  const t = getManualsMessages(locale);
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const hotelWide = !departmentId;

  useEffect(() => {
    loadHotelDepartments(locale).then(setDepartments).catch(() => setNotice(t.failed));
  }, [locale, t.failed]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) { setNotice(t.fileRequired); return; }
    setSaving(true);
    setNotice("");
    const form = new FormData();
    form.set("title", title.trim());
    form.set("scope", hotelWide ? "hotel" : "department");
    form.set("departmentId", departmentId);
    form.set("file", file);
    const response = await fetch("/api/manuals", { method: "POST", body: form });
    setSaving(false);
    if (!response.ok) { setNotice(t.failed); return; }
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
            <div className="hb-cat" style={{ marginTop: 8 }}>
              <div className={`hb-cat-btn${hotelWide ? " active" : ""}`} onClick={() => setDepartmentId("")}>{departmentIcon("", true)} {t.hotelWide}</div>
              {departments.map((department) => <div key={department.id} className={`hb-cat-btn${departmentId === department.id ? " active" : ""}`} onClick={() => setDepartmentId(department.id)}>{departmentIcon(department.name)} {department.name}</div>)}
            </div>
          </div>
          <label className="field-lbl">{t.docTitle}
            <input className="field-input" name="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.titlePlaceholder} />
          </label>
          <label className="field-lbl">{t.file}
            <input className="field-input" type="file" accept=".pdf,.doc,.docx,.txt,application/pdf,text/plain" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          {file ? <p style={{ fontSize: 12, color: "var(--text2)" }}>{file.name}</p> : <p style={{ fontSize: 12, color: "var(--text3)" }}>{t.formats}</p>}
          {notice ? <p role="status" style={{ fontSize: 12 }}>{notice}</p> : null}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Link href="/manuals" className="btn btn-ghost">{t.cancel}</Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>{t.create}</button>
          </div>
        </div>
      </form>
      {saving ? <BrandLoader label={t.loading} overlay /> : null}
    </main>
  </AppShell>;
}

export function ManualsViewPage({ id }: { id: string }) {
  const { locale } = useI18n();
  const t = getManualsMessages(locale);
  const [doc, setDoc] = useState<Pick<Doc, "id" | "title" | "originalName"> | null>(null);
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
    </main>
  </AppShell>;
}
