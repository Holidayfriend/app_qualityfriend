"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { BrandLoader } from "../ui/brand-loader";
import { useToast } from "../ui/toast-provider";
import { getHandoversMessages, type HandoversMessages } from "../../lib/i18n/handovers-messages";
import { useHandovers, type HotelDept } from "./handovers-provider";

type T = HandoversMessages;
type Visibility = "alle" | "dept" | "privat";
type Filter = "alle" | "offen" | "erledigt" | "draft";

function useT() {
  const { locale } = useI18n();
  return getHandoversMessages(locale);
}

function deptName(id: string, departments: HotelDept[]) {
  return departments.find((item) => item.id === id)?.name ?? id;
}

function visLabel(value: string, t: T) {
  return value === "dept" ? t.visDept : value === "privat" ? t.visMe : t.visAll;
}

function statusLabel(status: string, t: T) {
  return status === "erledigt" ? t.statusDone : status === "draft" ? t.statusDraft : t.statusOpen;
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return <AppShell activeItem="handovers" pageTitle={title}><main className="qf-dashboard pb-24 lg:pb-[24px]">{children}</main></AppShell>;
}

async function patchHandover(id: string, locale: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/handovers/${id}?locale=${locale}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export function HandoversDashboardPage() {
  const t = useT();
  const { handovers, canManage, ready } = useHandovers();
  if (!ready) return <Shell title={t.pageTitle}><BrandLoader label={t.loading} /></Shell>;
  const current = handovers.filter((item) => item.status === "offen" && item.pinned);
  const history = handovers.filter((item) => item.status !== "draft").slice(0, 4);

  return <Shell title={t.pageTitle}>
    <div className="g2">
      <div>
        <div className="section-title">{t.current}</div>
        {current.length ? current.map((item) => (
          <Link key={item.id} href={`/handovers/${item.id}`} className="rep" style={{ textDecoration: "none", marginBottom: 10 }}>
            <div className="rep-prio m" />
            <div className="rep-ic">📌</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{item.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 2, whiteSpace: "pre-line" }}>{item.desc}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{item.creator} · {item.date}</div>
            </div>
          </Link>
        )) : <div style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.emptyCurrent}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {canManage ? <div className="card">
          <div className="ch"><div className="ct">{t.createCard}</div></div>
          <div className="cb">
            <Link href="/handovers/new" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>{t.create}</Link>
          </div>
        </div> : null}
        <div className="card">
          <div className="ch"><div className="ct">{t.history}</div><Link href="/handovers/list" className="ca">{t.allArrow}</Link></div>
          <div className="cb">
            {history.length ? history.map((item) => (
              <Link key={item.id} href={`/handovers/${item.id}`} className="al" style={{ textDecoration: "none" }}>
                <div className={`al-ic ${item.status === "erledigt" ? "g" : "b"}`}>{item.status === "erledigt" ? "✓" : "📋"}</div>
                <div>
                  <div className="al-t">{item.title}</div>
                  <div className="al-m">{item.date} · {item.creator}</div>
                </div>
                <div className="al-r"><span className={`chip ${item.status === "erledigt" ? "chip-g" : "chip-b"}`}>{statusLabel(item.status, t)}</span></div>
              </Link>
            )) : <div style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.empty}</div>}
          </div>
        </div>
        <Link href="/handovers/list" className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }}>{t.manageAll}</Link>
      </div>
    </div>
  </Shell>;
}

export function HandoversListPage() {
  const t = useT();
  const router = useRouter();
  const { handovers, departments, canManage, ready } = useHandovers();
  const [filter, setFilter] = useState<Filter>("alle");
  const [query, setQuery] = useState("");
  if (!ready) return <Shell title={t.listTitle}><BrandLoader label={t.loading} /></Shell>;
  const rows = handovers.filter((item) => {
    const statusOk = filter === "alle" || item.status === filter;
    const text = `${item.title}${item.creator}${item.tags.join("")}`.toLowerCase();
    return statusOk && (!query || text.includes(query.toLowerCase()));
  });
  const filters: [Filter, string][] = [["alle", t.filterAll], ["offen", t.statusOpen], ["erledigt", t.statusDone], ...(canManage ? [["draft", t.statusDraft] as [Filter, string]] : [])];

  return <Shell title={t.listTitle}>
    <Link href="/handovers" className="back-link">{t.back}</Link>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div className="filter-row" style={{ marginBottom: 0 }}>
        {filters.map(([id, label]) => <button key={id} type="button" className={`filter-btn${filter === id ? " active" : ""}`} onClick={() => setFilter(id)}>{label}</button>)}
      </div>
      <input className="field-input" style={{ maxWidth: 220 }} placeholder={t.search} value={query} onChange={(event) => setQuery(event.target.value)} />
      {canManage ? <Link href="/handovers/new" className="btn btn-primary" style={{ marginLeft: "auto" }}>{t.createPlus}</Link> : null}
    </div>
    <div className="card" style={{ overflowX: "auto" }}>
      <table className="bud-table" style={{ width: "100%" }}>
        <thead><tr><th>{t.colTitle}</th><th>{t.colAuthor}</th><th>{t.colDepts}</th><th>{t.colVis}</th><th>{t.colStatus}</th><th>{t.colDate}</th>{canManage ? <th style={{ textAlign: "right" }}>{t.colActions}</th> : null}</tr></thead>
        <tbody>
          {rows.length ? rows.map((item) => <tr key={item.id} onClick={() => router.push(`/handovers/${item.id}`)} style={{ cursor: "pointer" }}>
            <td>{item.title}</td>
            <td>{item.creator}</td>
            <td>{item.depts.length ? item.depts.map((d) => <span key={d} className="chip chip-n" style={{ marginRight: 4 }}>{deptName(d, departments)}</span>) : <span className="chip chip-n">{item.visibility === "privat" ? t.visMe : t.allChip}</span>}</td>
            <td>{visLabel(item.visibility, t)}</td>
            <td><span className={`chip ${item.status === "erledigt" ? "chip-g" : item.status === "draft" ? "chip-a" : "chip-b"}`}>{statusLabel(item.status, t)}</span></td>
            <td>{item.date}</td>
            {canManage ? <td style={{ textAlign: "right" }}><Link href={`/handovers/${item.id}/edit`} className="icon-btn" onClick={(event) => event.stopPropagation()}>✏️</Link></td> : null}
          </tr>) : <tr><td colSpan={canManage ? 7 : 6} style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.empty}</td></tr>}
        </tbody>
      </table>
    </div>
  </Shell>;
}

export function HandoversFormPage({ id }: { id?: string }) {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const { handovers, templates, departments, reload, ready } = useHandovers();
  const existing = id ? handovers.find((item) => item.id === id) : undefined;
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [template, setTemplate] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("alle");
  const [depts, setDepts] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setDesc(existing.desc);
    setVisibility(existing.visibility);
    setDepts(existing.depts);
    setTags(existing.tags);
  }, [existing]);

  function applyTemplate(value: string) {
    setTemplate(value);
    const selected = templates.find((item) => item.id === value);
    if (!selected) return;
    setTitle(selected.title);
    setDesc(selected.desc);
    setVisibility(selected.visibility);
    setDepts(selected.depts);
    setTags(selected.tags);
  }

  function addTag() {
    const value = tagInput.trim();
    if (!value || tags.includes(value)) return;
    setTags([...tags, value]);
    setTagInput("");
  }

  function payload(kind: "handover" | "template", status?: "draft") {
    return {
      title: title.trim(),
      description: desc,
      tags,
      visibility,
      departmentIds: depts,
      kind,
      status,
    };
  }

  async function persist(kind: "handover" | "template", status?: "draft") {
    if (!title.trim()) { toast({ message: t.titleRequired, tone: "error" }); return; }
    setBusy(true);
    toast({ message: t.translating });
    try {
      const isEdit = Boolean(existing) && kind === "handover";
      const res = await fetch(isEdit ? `/api/handovers/${existing!.id}?locale=${locale}` : `/api/handovers?locale=${locale}`, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(kind, status)),
      });
      if (!res.ok) { toast({ message: t.saveFailed, tone: "error" }); return; }
      await reload();
      if (kind === "template") { toast({ message: t.templateSaved, tone: "success" }); return; }
      toast({ message: status === "draft" ? t.draftSaved : existing ? t.savedEdit : t.saved, tone: "success" });
      router.push("/handovers/list");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <Shell title={id ? t.detailTitle : t.createTitle}><BrandLoader label={t.loading} /></Shell>;

  return <Shell title={existing ? t.detailTitle : t.createTitle}>
    {busy ? <BrandLoader label={t.translating} overlay /> : null}
    <Link href="/handovers/list" className="back-link">{t.back}</Link>
    <form className="g2" onSubmit={(event: FormEvent) => { event.preventDefault(); void persist("handover"); }}>
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch">
            <div className="ct">{t.content}</div>
            <select className="field-select" style={{ maxWidth: 260 }} value={template} onChange={(event) => applyTemplate(event.target.value)}>
              <option value="">{t.chooseTemplate}</option>
              {templates.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </div>
          <div className="cb">
            <label className="field-lbl">{t.title}</label>
            <input className="field-input" style={{ marginBottom: 14 }} placeholder={t.titlePlaceholder} value={title} onChange={(event) => setTitle(event.target.value)} />
            <label className="field-lbl">{t.description}</label>
            <textarea className="field-input" style={{ minHeight: 180, resize: "vertical", lineHeight: 1.6 }} placeholder={t.descPlaceholder} value={desc} onChange={(event) => setDesc(event.target.value)} />
            <div style={{ fontSize: 11.5, color: "var(--text3)", margin: "6px 0 0" }}>{t.autoTranslate}</div>
          </div>
        </div>
      </div>
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><div className="ct">{t.visibility}</div></div>
          <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="radio" name="hov-vis" checked={visibility === "alle"} onChange={() => setVisibility("alle")} /> {t.visAll}</label>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="radio" name="hov-vis" checked={visibility === "dept"} onChange={() => setVisibility("dept")} /> {t.visDept}</label>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="radio" name="hov-vis" checked={visibility === "privat"} onChange={() => setVisibility("privat")} /> {t.visMe}</label>
            {visibility === "dept" ? <div style={{ marginTop: 6 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{depts.map((dept) => <span key={dept} className="chip chip-n">{deptName(dept, departments)} <span style={{ cursor: "pointer", marginLeft: 4 }} onClick={() => setDepts(depts.filter((item) => item !== dept))}>✕</span></span>)}</div>
              <select className="field-select" value="" onChange={(event) => { const value = event.target.value; if (value && !depts.includes(value)) setDepts([...depts, value]); }}><option value="">{t.addDept}</option>{departments.filter((dept) => !depts.includes(dept.id)).map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}</select>
            </div> : null}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><div className="ct">{t.tags}</div></div>
          <div className="cb">
            <input className="field-input" placeholder={t.tagPlaceholder} value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{tags.map((tag, index) => <span key={`${tag}-${index}`} className="chip chip-b">{tag} <span style={{ cursor: "pointer", marginLeft: 4 }} onClick={() => setTags(tags.filter((_, i) => i !== index))}>✕</span></span>)}</div>
          </div>
        </div>
        <div className="card">
          <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>{t.save}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void persist("handover", "draft")}>{t.saveDraft}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void persist("template")}>{t.saveTemplate}</button>
          </div>
        </div>
      </div>
    </form>
  </Shell>;
}

export function HandoversDetailPage({ id }: { id: string }) {
  const t = useT();
  const { locale } = useI18n();
  const { handovers, departments, canManage, reload, ready } = useHandovers();
  const item = handovers.find((row) => row.id === id);
  const [busy, setBusy] = useState(false);

  if (!ready) return <Shell title={t.detailTitle}><BrandLoader label={t.loading} /></Shell>;
  if (!item) return <Shell title={t.detailTitle}><Link href="/handovers/list" className="back-link">{t.back}</Link><p style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.empty}</p></Shell>;

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    const ok = await patchHandover(id, locale, body);
    if (ok) await reload();
    setBusy(false);
  }

  return <Shell title={t.detailTitle}>
    {busy ? <BrandLoader label={t.loading} overlay /> : null}
    <Link href="/handovers/list" className="back-link">{t.back}</Link>
    <div className="card">
      <div className="ch">
        <div><div className="ct">{item.title}</div><div style={{ fontSize: 11.5, color: "var(--text2)", fontWeight: 400, marginTop: 2 }}>{item.creator} · {item.date}</div></div>
        <span className={`chip ${item.status === "erledigt" ? "chip-g" : item.status === "draft" ? "chip-a" : "chip-b"}`}>{statusLabel(item.status, t)}</span>
      </div>
      <div className="cb">
        <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: 14 }}>{item.desc}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {item.depts.length ? item.depts.map((dept) => <span key={dept} className="chip chip-n">{deptName(dept, departments)}</span>) : <span className="chip chip-n">{visLabel(item.visibility, t)}</span>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{item.tags.map((tag) => <span key={tag} className="chip chip-b">{tag}</span>)}</div>
        {item.status === "erledigt" && item.completedAt ? <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 12 }}>{t.completedMeta.replace("{when}", item.completedAt).replace("{name}", item.completedBy || "–")}</div> : null}
      </div>
      <div className="cb" style={{ borderTop: "1px solid var(--border)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {item.status !== "draft" ? <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void run({ action: "status", status: item.status === "erledigt" ? "offen" : "erledigt" })}>{item.status === "erledigt" ? t.reopen : t.markDone}</button> : null}
        {canManage ? <Link href={`/handovers/${item.id}/edit`} className="btn btn-ghost">{t.edit}</Link> : null}
        {item.status === "offen" ? <label style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6, marginLeft: "auto", cursor: "pointer" }}>
          <input type="checkbox" checked={item.pinned} disabled={busy} onChange={(event) => void run({ action: "pin", pinned: event.target.checked })} /> {t.pin}
        </label> : null}
      </div>
    </div>
  </Shell>;
}
