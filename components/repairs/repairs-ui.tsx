"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { BrandLoader } from "../ui/brand-loader";
import { useToast } from "../ui/toast-provider";
import { getRepairsMessages, type RepairsMessages } from "../../lib/i18n/repairs-messages";
import { REPAIR_AREA_KEYS, STATUS_CHIP, type RepairAreaKey, type RepairFile, type RepairStatus, type RepairVisibility } from "../../lib/repairs/demo-data";
import { useRepairs, type HotelDept, type HotelUser, type PublicRepair } from "./repairs-provider";

type T = RepairsMessages;
type Filter = "alle" | RepairStatus;

function useT() {
  const { locale } = useI18n();
  return getRepairsMessages(locale);
}

function asStatus(status: string): RepairStatus {
  return (["neu", "uebernommen", "in_arbeit", "wartet", "erledigt"].includes(status) ? status : "neu") as RepairStatus;
}

function statusLabel(status: string, t: T) {
  return { neu: t.statusNeu, uebernommen: t.statusUebernommen, in_arbeit: t.statusInArbeit, wartet: t.statusWartet, erledigt: t.statusErledigt }[asStatus(status)];
}

function deptName(id: string, departments: HotelDept[], t: T) {
  return departments.find((item) => item.id === id)?.name ?? t.depts[id as keyof T["depts"]] ?? id;
}

function assigneeSelectValue(assignee: string, users: HotelUser[]) {
  return users.find((item) => item.id === assignee || item.name === assignee)?.id ?? assignee;
}

function isUrgent(tags: string[]) {
  return tags.some((tag) => /urgent|dringend|urgente/i.test(tag));
}

function fileIcon(type: RepairFile["type"]) {
  return type === "photo" ? "📷" : type === "video" ? "🎥" : "🎤";
}

function fill(template: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

function locationLabel(location: string, t: T) {
  const value = location.trim();
  if (!value) return "–";
  if (REPAIR_AREA_KEYS.includes(value as RepairAreaKey)) return t.areas[value as RepairAreaKey];
  if (/^\d+[a-z]?$/i.test(value)) return `${t.room} ${value}`;
  return value;
}

function locationStats(repairs: PublicRepair[]) {
  const counts = new Map<string, { count: number; label: string }>();
  for (const item of repairs) {
    const key = (item.locationKey || item.location || "").trim();
    if (!key) continue;
    const entry = counts.get(key) ?? { count: 0, label: item.location || key };
    entry.count += 1;
    if (item.location) entry.label = item.location;
    counts.set(key, entry);
  }
  return [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 3);
}

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return <AppShell activeItem="repairs" pageTitle={title}><main className="qf-dashboard pb-24 lg:pb-[24px]">{children}</main></AppShell>;
}

async function patchRepair(id: string, locale: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/repairs/${id}?locale=${locale}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export function RepairsDashboardPage() {
  const t = useT();
  const { repairs, departments, canManage, ready, avgResponseDays } = useRepairs();
  if (!ready) return <Shell title={t.pageTitle}><BrandLoader label={t.loading} /></Shell>;
  const open = repairs.filter((item) => item.status !== "erledigt");
  const inArbeit = repairs.filter((item) => item.status === "in_arbeit").length;
  const done = repairs.filter((item) => item.status === "erledigt").length;
  const avg = avgResponseDays == null ? "–" : String(avgResponseDays);

  return <Shell title={t.pageTitle}>
    <div className="kpi-row" style={{ marginBottom: 18 }}>
      <div className="kpi"><div className="kpi-lbl">{t.kpiOpen}</div><div className="kpi-val" style={{ color: "var(--red)" }}>{open.length}</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiInProgress}</div><div className="kpi-val" style={{ color: "var(--amber)" }}>{inArbeit}</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiDoneWeek}</div><div className="kpi-val" style={{ color: "var(--green)" }}>{done}</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.kpiAvg}</div><div className="kpi-val">{avg}{avg !== "–" ? <span>{t.kpiAvgUnit}</span> : null}</div></div>
    </div>
    <div className="g2">
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>{t.openSection}</div>
          <Link href="/repairs/list" className="ca">{t.manageAll}</Link>
        </div>
        {open.length ? open.map((item) => {
          const urgent = isUrgent(item.tags);
          return <Link key={item.id} href={`/repairs/${item.id}`} className="rep" style={{ textDecoration: "none" }}>
            <div className={`rep-prio ${urgent ? "h" : "m"}`} />
            <div className="rep-ic" style={{ background: urgent ? "var(--red-bg)" : "var(--amber-bg)" }}>{urgent ? "🔥" : "🔧"}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{item.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--text2)", marginTop: 2 }}>{item.location} · {item.assignee || t.unassigned} · {item.depts.length ? item.depts.map((d) => deptName(d, departments, t)).join(", ") : t.allChip}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{t.reported}: {item.date} · {item.creator}</div>
            </div>
            <span className={`chip ${STATUS_CHIP[asStatus(item.status)]}`}>{statusLabel(item.status, t).toUpperCase()}</span>
          </Link>;
        }) : <div style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.emptyOpen}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {canManage ? <div className="card">
          <div className="ch"><div className="ct">{t.reportCard}</div></div>
          <div className="cb">
            <Link href="/repairs/new" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>{t.create}</Link>
          </div>
        </div> : null}
        <div className="card">
          <div className="ch"><div className="ct">{t.stats}</div></div>
          <div className="cb">
            {(() => {
              const rows = locationStats(repairs);
              const max = rows[0]?.[1].count ?? 1;
              const bars = ["bar-r", "bar-a", "bar-g"];
              if (!rows.length) return <div style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.statEmpty}</div>;
              return rows.map(([key, row], index) => <div key={key} style={{ marginBottom: index === rows.length - 1 ? 0 : 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{row.label || locationLabel(key, t)}</span><span>{fill(t.timesThisYear, { count: String(row.count) })}</span></div>
                <div className="progress-bar"><div className={`progress-fill ${bars[index] || "bar-g"}`} style={{ width: `${Math.max(12, Math.round((row.count / max) * 100))}%` }} /></div>
              </div>);
            })()}
          </div>
        </div>
      </div>
    </div>
  </Shell>;
}

export function RepairsListPage() {
  const t = useT();
  const router = useRouter();
  const { repairs, departments, canManage, ready } = useRepairs();
  const [filter, setFilter] = useState<Filter>("alle");
  const [query, setQuery] = useState("");
  if (!ready) return <Shell title={t.listTitle}><BrandLoader label={t.loading} /></Shell>;
  const rows = repairs.filter((item) => {
    const statusOk = filter === "alle" || item.status === filter;
    const text = `${item.title}${item.location}${item.creator}${item.assignee}${item.tags.join("")}`.toLowerCase();
    return statusOk && (!query || text.includes(query.toLowerCase()));
  });
  const filters: [Filter, string][] = [["alle", t.filterAll], ["neu", t.statusNeu], ["uebernommen", t.statusUebernommen], ["in_arbeit", t.statusInArbeit], ["wartet", t.statusWartet], ["erledigt", t.statusErledigt]];

  return <Shell title={t.listTitle}>
    <Link href="/repairs" className="back-link">{t.back}</Link>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div className="filter-row" style={{ marginBottom: 0 }}>
        {filters.map(([id, label]) => <button key={id} type="button" className={`filter-btn${filter === id ? " active" : ""}`} onClick={() => setFilter(id)}>{label}</button>)}
      </div>
      <input className="field-input" style={{ maxWidth: 220 }} placeholder={t.search} value={query} onChange={(event) => setQuery(event.target.value)} />
      {canManage ? <Link href="/repairs/new" className="btn btn-primary" style={{ marginLeft: "auto" }}>{t.createPlus}</Link> : null}
    </div>
    <div className="card" style={{ overflowX: "auto" }}>
      <table className="bud-table" style={{ width: "100%" }}>
        <thead><tr><th>{t.colTitle}</th><th>{t.colLocation}</th><th>{t.colAuthor}</th><th>{t.colAssignee}</th><th>{t.colDepts}</th><th>{t.colStatus}</th><th>{t.colDate}</th>{canManage ? <th style={{ textAlign: "right" }}>{t.colActions}</th> : null}</tr></thead>
        <tbody>
          {rows.length ? rows.map((item) => <tr key={item.id} onClick={() => router.push(`/repairs/${item.id}`)} style={{ cursor: "pointer" }}>
            <td>{item.title}</td>
            <td>{item.location}</td>
            <td>{item.creator}</td>
            <td>{item.assignee || t.unassigned}</td>
            <td>{item.depts.length ? item.depts.map((d) => <span key={d} className="chip chip-n" style={{ marginRight: 4 }}>{deptName(d, departments, t)}</span>) : <span className="chip chip-n">{t.allChip}</span>}</td>
            <td><span className={`chip ${STATUS_CHIP[asStatus(item.status)]}`}>{statusLabel(item.status, t)}</span></td>
            <td>{item.date}</td>
            {canManage ? <td style={{ textAlign: "right" }}><Link href={`/repairs/${item.id}/edit`} className="icon-btn" onClick={(event) => event.stopPropagation()}>✏️</Link></td> : null}
          </tr>) : <tr><td colSpan={canManage ? 8 : 7} style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.empty}</td></tr>}
        </tbody>
      </table>
    </div>
  </Shell>;
}

export function RepairsFormPage({ id }: { id?: string }) {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const { repairs, templates, rooms, departments, users, reload, ready } = useRepairs();
  const existing = id ? repairs.find((item) => item.id === id) : undefined;
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [desc, setDesc] = useState("");
  const [template, setTemplate] = useState("");
  const [visibility, setVisibility] = useState<RepairVisibility>("alle");
  const [depts, setDepts] = useState<string[]>([]);
  const [assignee, setAssignee] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [attachments, setAttachments] = useState<RepairFile[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!existing) return;
    const key = existing.locationKey || existing.location || "";
    setTitle(existing.title);
    setLocation(key);
    setCustomLocation(REPAIR_AREA_KEYS.includes(key as RepairAreaKey) || /^\d+[a-z]?$/i.test(key) ? "" : key);
    setDesc(existing.desc);
    setVisibility(existing.visibility);
    setDepts(existing.depts);
    setAssignee(existing.assigneeId || assigneeSelectValue(existing.assignee, users));
    setTags(existing.tags);
  }, [existing, users]);

  function applyTemplate(value: string) {
    setTemplate(value);
    const selected = templates.find((item) => item.id === value);
    if (!selected) return;
    const key = selected.locationKey || selected.location || "";
    setTitle(selected.title);
    setDesc(selected.desc);
    setLocation(key);
    setCustomLocation(REPAIR_AREA_KEYS.includes(key as RepairAreaKey) || /^\d+[a-z]?$/i.test(key) ? "" : key);
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

  function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const extra: RepairFile[] = [...files].map((file) => ({
      name: file.name,
      type: file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "voice" : "photo",
    }));
    setAttachments((current) => [...current, ...extra]);
  }

  function payload(kind: "repair" | "template") {
    const savedLocation = (location === "__custom__" ? customLocation : location).trim();
    return {
      title: title.trim(),
      description: desc,
      locationKey: savedLocation,
      locationLabel: locationLabel(savedLocation, t),
      tags,
      visibility,
      departmentIds: visibility === "dept" ? depts : [],
      assigneeId: kind === "template" ? "" : assignee,
      kind,
    };
  }

  async function persist(kind: "repair" | "template") {
    if (!title.trim()) { toast({ message: t.titleRequired, tone: "error" }); return; }
    const savedLocation = (location === "__custom__" ? customLocation : location).trim();
    if (!savedLocation || savedLocation === "__custom__") { toast({ message: t.locationRequired, tone: "error" }); return; }
    setBusy(true);
    toast({ message: t.translating });
    try {
      const isEdit = Boolean(existing) && kind === "repair";
      const res = await fetch(isEdit ? `/api/repairs/${existing!.id}?locale=${locale}` : `/api/repairs?locale=${locale}`, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(kind)),
      });
      if (!res.ok) { toast({ message: t.saveFailed, tone: "error" }); return; }
      await reload();
      if (kind === "template") {
        toast({ message: t.templateSaved, tone: "success" });
        return;
      }
      toast({ message: existing ? t.savedEdit : t.saved, tone: "success" });
      router.push("/repairs/list");
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    void persist("repair");
  }

  if (!ready) return <Shell title={id ? t.detailTitle : t.createTitle}><BrandLoader label={t.loading} /></Shell>;

  return <Shell title={existing ? t.detailTitle : t.createTitle}>
    {busy ? <BrandLoader label={t.translating} overlay /> : null}
    <Link href="/repairs/list" className="back-link">{t.back}</Link>
    <form className="g2" onSubmit={save}>
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
            <label className="field-lbl">{t.location}</label>
            {(() => {
              const isArea = REPAIR_AREA_KEYS.includes(location as RepairAreaKey);
              const isRoomLoc = Boolean(location) && (rooms.some((room) => room.number === location) || /^\d+[a-z]?$/i.test(location));
              const selectValue = isRoomLoc || isArea || location === "" ? location : "__custom__";
              const extraRoom = isRoomLoc && !rooms.some((room) => room.number === location);
              return <>
                <select className="field-select" style={{ marginBottom: selectValue === "__custom__" ? 8 : 14 }} value={selectValue} onChange={(event) => { const value = event.target.value; setLocation(value); if (value !== "__custom__") setCustomLocation(""); }}>
                  <option value="">{t.chooseLocation}</option>
                  <optgroup label={t.locationRooms}>
                    {extraRoom ? <option value={location}>{t.room} {location}</option> : null}
                    {rooms.map((room) => <option key={room.id} value={room.number}>{t.room} {room.number}</option>)}
                  </optgroup>
                  <optgroup label={t.locationAreas}>{REPAIR_AREA_KEYS.map((key) => <option key={key} value={key}>{t.areas[key]}</option>)}</optgroup>
                  <option value="__custom__">{t.locationCustom}</option>
                </select>
                {selectValue === "__custom__" ? <input className="field-input" style={{ marginBottom: 14 }} placeholder={t.locationCustomPlaceholder} value={customLocation} onChange={(event) => { setLocation("__custom__"); setCustomLocation(event.target.value); }} /> : null}
              </>;
            })()}
            <label className="field-lbl">{t.description}</label>
            <textarea className="field-input" style={{ minHeight: 140, resize: "vertical", lineHeight: 1.6 }} placeholder={t.descPlaceholder} value={desc} onChange={(event) => setDesc(event.target.value)} />
            <div style={{ fontSize: 11.5, color: "var(--text3)", margin: "6px 0 16px" }}>{t.autoTranslate}</div>
            <label className="field-lbl">{t.attachment}</label>
            <button type="button" className="dropzone" style={{ marginBottom: 0 }} onClick={() => fileInput.current?.click()}>{t.dropzone}<br /><span style={{ fontSize: 11 }}>{t.dropHint}</span></button>
            <input ref={fileInput} type="file" hidden multiple accept="image/*,video/*,audio/*" onChange={(event) => { onFiles(event.target.files); event.target.value = ""; }} />
            <div style={{ marginTop: 10 }}>{attachments.map((file, index) => <div key={`${file.name}-${index}`} className="doc-row"><div className="doc-ic">{fileIcon(file.type)}</div><div className="doc-name">{file.name}</div><button type="button" className="icon-btn danger" onClick={() => setAttachments(attachments.filter((_, i) => i !== index))}>🗑️</button></div>)}</div>
          </div>
        </div>
      </div>
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><div className="ct">{t.deptsCard}</div></div>
          <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="radio" name="repair-vis" checked={visibility === "alle"} onChange={() => setVisibility("alle")} /> {t.visAll}</label>
            <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="radio" name="repair-vis" checked={visibility === "dept"} onChange={() => setVisibility("dept")} /> {t.visDept}</label>
            {visibility === "dept" ? <div style={{ marginTop: 6 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{depts.map((dept) => <span key={dept} className="chip chip-n">{deptName(dept, departments, t)} <span style={{ cursor: "pointer", marginLeft: 4 }} onClick={() => setDepts(depts.filter((item) => item !== dept))}>✕</span></span>)}</div>
              <select className="field-select" value="" onChange={(event) => { const value = event.target.value; if (value && !depts.includes(value)) setDepts([...depts, value]); }}><option value="">{t.addDept}</option>{departments.filter((dept) => !depts.includes(dept.id)).map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}</select>
            </div> : null}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><div className="ct">{t.assignee}</div></div>
          <div className="cb">
            <select className="field-select" style={{ marginBottom: 0 }} value={assigneeSelectValue(assignee, users)} onChange={(event) => setAssignee(event.target.value)}>
              <option value="">{t.unassigned}</option>
              {assignee && !users.some((user) => user.id === assignee || user.name === assignee) ? <option value={assignee}>{assignee}</option> : null}
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
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
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => toast({ message: t.draftSaved })}>{t.saveDraft}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void persist("template")}>{t.saveTemplate}</button>
          </div>
        </div>
      </div>
    </form>
  </Shell>;
}

export function RepairsDetailPage({ id }: { id: string }) {
  const t = useT();
  const { locale } = useI18n();
  const { repairs, departments, users, canManage, reload, ready } = useRepairs();
  const item = repairs.find((row) => row.id === id);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  if (!ready) return <Shell title={t.detailTitle}><BrandLoader label={t.loading} /></Shell>;
  if (!item) return <Shell title={t.detailTitle}><Link href="/repairs/list" className="back-link">{t.back}</Link><p style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.empty}</p></Shell>;

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    const ok = await patchRepair(id, locale, body);
    if (ok) await reload();
    setBusy(false);
  }

  return <Shell title={t.detailTitle}>
    {busy ? <BrandLoader label={t.loading} overlay /> : null}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <Link href="/repairs/list" className="back-link">{t.back}</Link>
      {canManage ? <Link href={`/repairs/${item.id}/edit`} className="btn btn-ghost">✏️</Link> : null}
    </div>
    <div className="card">
      <div className="ch">
        <div><div className="ct">{item.title}</div><div style={{ fontSize: 11.5, color: "var(--text2)", fontWeight: 400, marginTop: 2 }}>{item.location} · {item.creator} · {item.date}</div></div>
        <span className={`chip ${STATUS_CHIP[asStatus(item.status)]}`}>{statusLabel(item.status, t)}</span>
      </div>
      <div className="cb" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}><label className="field-lbl" style={{ marginBottom: 4 }}>{t.assignee}</label>
          <select className="field-select" disabled={busy} value={assigneeSelectValue(item.assigneeId || item.assignee, users)} onChange={(event) => void run({ action: "assignee", assigneeId: event.target.value })}>
            <option value="">{t.unassigned}</option>
            {item.assignee && !users.some((user) => user.id === item.assigneeId || user.name === item.assignee) ? <option value={item.assigneeId || item.assignee}>{item.assignee}</option> : null}
            {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}><label className="field-lbl" style={{ marginBottom: 4 }}>{t.colStatus}</label>
          <select className="field-select" disabled={busy} value={item.status} onChange={(event) => void run({ action: "status", status: event.target.value })}>
            <option value="neu">{t.statusNeu}</option>
            <option value="uebernommen">{t.statusUebernommen}</option>
            <option value="in_arbeit">{t.statusInArbeit}</option>
            <option value="wartet">{t.statusWartetLong}</option>
            <option value="erledigt">{t.statusErledigt}</option>
          </select>
        </div>
      </div>
      <div className="cb">
        <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-line", marginBottom: 14 }}>{item.desc}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{item.depts.length ? item.depts.map((dept) => <span key={dept} className="chip chip-n">{deptName(dept, departments, t)}</span>) : <span className="chip chip-n">{t.visibleAll}</span>}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{item.tags.map((tag) => <span key={tag} className="chip chip-b">{tag}</span>)}</div>
      </div>
      <div className="cb" style={{ borderTop: "1px solid var(--border)" }}>
        <label className="field-lbl" style={{ marginBottom: 6 }}>{t.comments}</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {item.comments.length ? item.comments.map((row, index) => <div key={index} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px" }}><div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{row.text}</div><div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{row.author} · {row.date}</div></div>) : <div style={{ fontSize: 12, color: "var(--text3)" }}>{t.noComments}</div>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="field-input" placeholder={t.commentPlaceholder} value={comment} onChange={(event) => setComment(event.target.value)} />
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => {
            const text = comment.trim();
            if (!text) return;
            setComment("");
            void run({ action: "comment", text });
          }}>{t.add}</button>
        </div>
      </div>
    </div>
  </Shell>;
}
