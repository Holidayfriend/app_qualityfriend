"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useRef, type FormEvent } from "react";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { fill, getRecruitingMessages, type DeptId, type RecruitingMessages } from "../../lib/i18n/recruiting-messages";
import type { Locale } from "../../lib/i18n/dictionaries";
import { deptIds, langFlags, type Applicant, type AppStage, type EmailCat, type EmailTemplates, type Employee, type Job, type JobStatus } from "../../lib/recruiting/preview-data";
import { useRecruiting } from "./recruiting-provider";
import { createDefaultQuiz, DEFAULT_FOOTER_URL, QuizCanvasCard, QuizToolsCard, type QuizFooter, type QuizPage } from "./quiz-builder";
import { BrandLoader } from "../ui/brand-loader";
import { htmlToPlain, RichTextEditor, sanitizeJobHtml, type RichTextEditorHandle } from "./rich-text-editor";
import type { PublicJob } from "../../lib/recruiting/job-fields";

export type RecruitingView =
  | "hub" | "jobs" | "job-create" | "job-edit" | "job-quiz" | "applications" | "application-create" | "application-detail"
  | "employees" | "employee-create" | "employee-detail" | "settings" | "emails";

type T = RecruitingMessages;
type HotelDept = { id: string; name: string };

function ApplyPageLink({ slug, title }: { slug?: string; title: string }) {
  if (!slug) return null;
  return <a href={`/apply/${slug}`} className="icon-btn" target="_blank" rel="noreferrer" title={title}>↗</a>;
}

function useHotelDepartments(locale: Locale) {
  const [departments, setDepartments] = useState<HotelDept[]>([]);
  useEffect(() => {
    fetch(`/api/recruiting/departments?locale=${locale}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (Array.isArray(data?.departments)) setDepartments(data.departments); })
      .catch(() => undefined);
  }, [locale]);
  return departments;
}

export function RecruitingUI({ view, id = "" }: { view: RecruitingView; id?: string }) {
  const { locale } = useI18n();
  const t = getRecruitingMessages(locale);
  const titles: Record<RecruitingView, string> = {
    hub: t.title, jobs: t.jobsTitle, "job-create": t.jobCreateTitle, "job-edit": t.jobEditTitle, "job-quiz": t.quizName, applications: t.applicationsTitle,
    "application-create": t.applicationCreateTitle, "application-detail": t.applicationDetailTitle,
    employees: t.employeesTitle, "employee-create": t.employeeCreateTitle, "employee-detail": t.employeeDetailTitle, settings: t.settingsTitle, emails: t.emailsTitle,
  };
  return <AppShell activeItem="recruiting" pageTitle={titles[view]}>
    <main className={`qf-dashboard ${view === "job-quiz" || view === "job-edit" ? "qf-dashboard-sticky" : ""}`}>
      {view === "hub" ? <Hub t={t} /> : null}
      {view === "jobs" ? <Jobs t={t} locale={locale} /> : null}
      {view === "job-create" ? <JobCreate t={t} locale={locale} /> : null}
      {view === "job-edit" ? <JobEdit t={t} locale={locale} id={id} /> : null}
      {view === "job-quiz" ? <JobQuiz t={t} locale={locale} /> : null}
      {view === "applications" ? <Applications t={t} locale={locale} /> : null}
      {view === "application-create" ? <ApplicationCreate t={t} locale={locale} /> : null}
      {view === "application-detail" ? <ApplicationDetail t={t} locale={locale} id={id} /> : null}
      {view === "employees" ? <Employees t={t} /> : null}
      {view === "employee-create" ? <EmployeeCreate t={t} /> : null}
      {view === "employee-detail" ? <EmployeeDetail t={t} id={id} /> : null}
      {view === "settings" ? <EmailSettings t={t} /> : null}
      {view === "emails" ? <Emails t={t} locale={locale} /> : null}
    </main>
  </AppShell>;
}

function KpiHint({ text }: { text: string }) {
  return (
    <span className="kpi-info">
      <button type="button" className="kpi-info-btn" aria-label={text}>?</button>
      <span className="kpi-info-tip" role="tooltip">{text}</span>
    </span>
  );
}

function Back({ href, label }: { href: string; label: string }) {
  return <Link href={href} className="back-link">{label}</Link>;
}

function Hub({ t }: { t: T }) {
  const { applicants, employees } = useRecruiting();
  const reminders = useMemo(() => buildReminders(employees, t), [employees, t]);
  const openJobs = 4;
  const newApps = applicants.filter((item) => item.stage === "new").length;
  return <>
    <div className="ai-banner">
      <div style={{ fontSize: 20 }}>✨</div>
      <div style={{ flex: 1 }}><div className="ai-title">{t.aiTitle}</div><div className="ai-body">{t.aiBody}</div></div>
      <Link href="/recruiting/jobs/new" className="ai-btn">{t.createJob}</Link>
    </div>
    <div className="kpi-row">
      <div className="kpi"><div className="kpi-lbl">{t.openJobs}</div><div className="kpi-val">{openJobs}</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.newApps7d}</div><div className="kpi-val" style={{ color: "var(--accent)" }}>{newApps}</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.interviewsWeek}</div><div className="kpi-val">2</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.timeToHire}</div><div className="kpi-val">18<span>{t.days}</span></div></div>
    </div>
    <div className="section-title">{t.modules}</div>
    <div className="settings-grid" style={{ marginBottom: 20 }}>
      <div className="card">
        <div className="ch"><div className="ct">{t.jobsApps}</div></div>
        <Link href="/recruiting/jobs" className="settings-item"><div className="settings-ic">📢</div><div><div className="settings-t">{t.jobs}</div><div className="settings-d">{t.jobsHint}</div></div></Link>
        <Link href="/recruiting/applications" className="settings-item"><div className="settings-ic">📨</div><div><div className="settings-t">{t.applications}</div><div className="settings-d">{t.applicationsHint}</div></div></Link>
        <Link href="/recruiting/employees" className="settings-item"><div className="settings-ic">🧑‍🍳</div><div><div className="settings-t">{t.employees}</div><div className="settings-d">{t.employeesHint}</div></div></Link>
      </div>
      <div className="card">
        <div className="ch"><div className="ct">{t.automation}</div></div>
        <Link href="/recruiting/settings" className="settings-item"><div className="settings-ic">⚙️</div><div><div className="settings-t">{t.settings}</div><div className="settings-d">{t.settingsHint}</div></div></Link>
        <Link href="/recruiting/emails" className="settings-item"><div className="settings-ic">✉️</div><div><div className="settings-t">{t.emails}</div><div className="settings-d">{t.emailsHint}</div></div></Link>
        <div className="settings-item" style={{ cursor: "default" }}><div className="settings-ic">🔔</div><div><div className="settings-t">{t.reminders}</div><div className="settings-d">{t.remindersHint}</div></div></div>
      </div>
    </div>
    <div className="section-title">{t.upcomingReminders}</div>
    <div className="card"><div className="cb">
      {reminders.length ? reminders.map((item) => <div className="al" key={item.title}><div className={`al-ic ${item.cls}`}>{item.icon}</div><div><div className="al-t">{item.title}</div><div className="al-m">{item.meta}</div></div></div>)
        : <div style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.noReminders}</div>}
    </div></div>
  </>;
}

function Jobs({ t, locale }: { t: T; locale: Locale }) {
  const { jobs, setJobs } = useRecruiting();
  const [filter, setFilter] = useState<"all" | JobStatus>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    fetch(`/api/recruiting/jobs?locale=${locale}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!ignore && Array.isArray(data?.jobs)) setJobs(data.jobs); })
      .catch(() => undefined)
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [locale, setJobs]);
  const clicks = jobs.reduce((sum, job) => sum + job.clicks, 0);
  const apps = jobs.reduce((sum, job) => sum + job.apps, 0);
  const avgConv = clicks ? ((apps / clicks) * 100).toFixed(1) : "–";
  const best = [...jobs].sort((a, b) => parseFloat(b.conv) - parseFloat(a.conv))[0];
  const rows = jobs.filter((job) => (filter === "all" || job.status === filter) && job.title.toLowerCase().includes(search.toLowerCase()));
  const statusLabel = (status: JobStatus) => status === "active" ? t.active : status === "draft" ? t.draft : t.archived;
  async function toggleArchive(id: string) {
    const job = jobs.find((item) => item.id === id);
    if (!job) return;
    const status = job.status === "archived" ? "active" : "archived";
    const res = await fetch(`/api/recruiting/jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) return;
    setJobs(jobs.map((item) => item.id === id ? { ...item, status } : item));
  }
  return <>
    <Back href="/recruiting" label={t.backRecruiting} />
    <div className="kpi-row" style={{ marginBottom: 14 }}>
      <div className="kpi"><div className="kpi-lbl">{t.clicksTotal}<KpiHint text={t.clicksTotalHint} /></div><div className="kpi-val">{clicks}</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.appsTotal}</div><div className="kpi-val" style={{ color: "var(--accent)" }}>{apps}</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.avgConversion}<KpiHint text={t.avgConversionHint} /></div><div className="kpi-val">{avgConv}{avgConv !== "–" ? <span>%</span> : null}</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.bestListing}<KpiHint text={t.bestListingHint} /></div><div className="kpi-val" style={{ fontSize: 15 }}>{best?.title.split(" ")[0] || "–"}<span style={{ display: "block", fontSize: 11, color: "var(--text2)", fontWeight: 400 }}>{best ? `${best.conv} ${t.conversion}` : ""}</span></div></div>
    </div>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div className="filter-row" style={{ marginBottom: 0 }}>
        {([["all", t.all], ["active", t.active], ["draft", t.draft], ["archived", t.archived]] as const).map(([key, label]) =>
          <button key={key} type="button" className={`filter-btn ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>{label}</button>)}
      </div>
      <input className="field-input" style={{ maxWidth: 220 }} placeholder={t.search} value={search} onChange={(event) => setSearch(event.target.value)} />
      <Link href="/recruiting/jobs/new" className="btn btn-primary" style={{ marginLeft: "auto" }}>{t.newJob}</Link>
    </div>
    <div className="card" style={{ overflowX: "auto" }}>
      <table className="bud-table"><thead><tr><th>{t.colTitle}</th><th>{t.colLanguages}</th><th>{t.colDepartment}</th><th>{t.colStatus}</th><th>{t.colClicks}</th><th>{t.colApps}</th><th>{t.colConv}</th><th style={{ textAlign: "right" }}>{t.colActions}</th></tr></thead>
        <tbody>{rows.map((job) => <tr key={job.id}>
          <td>
            <div>{job.title}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>{job.format === "quiz" ? t.formatQuiz : t.formatClassic}{job.slug ? ` · /apply/${job.slug}` : ""}</div>
          </td>
          <td>{(job.langs ?? []).map((lang) => langFlags[lang]).join("")}</td><td>{job.dept}</td>
          <td><span className={`status-pill ${job.status === "active" ? "active" : "inactive"}`}>{statusLabel(job.status)}</span></td>
          <td>{job.clicks || "–"}</td><td>{job.apps || "–"}</td><td>{job.conv}</td>
          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <ApplyPageLink slug={job.slug} title={t.applyOpen} />
            {" "}
            <Link href={`/recruiting/jobs/${job.id}`} className="icon-btn">✏️</Link> <button type="button" className="icon-btn" onClick={() => void toggleArchive(job.id)}>{job.status === "archived" ? "↩️" : "🗄️"}</button>
          </td>
        </tr>)}</tbody>
      </table>
    </div>
    {loading ? <BrandLoader label={t.loading} overlay /> : null}
  </>;
}

function ImageField({ t, label, hint, value, onChange, invalid = false, kind = "banner" }: { t: T; label: string; hint: string; value: string; onChange: (url: string) => void; invalid?: boolean; kind?: "banner" | "favicon" }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function take(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    setBusy(true);
    const body = new FormData();
    body.set("image", file);
    const res = await fetch("/api/recruiting/jobs/images", { method: "POST", body });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (res.ok && typeof data?.url === "string") onChange(data.url);
  }
  return (
    <div>
      <span className="field-lbl">{label}</span>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(event) => { void take(event.target.files?.[0]); event.target.value = ""; }} />
      <button
        type="button"
        className={`dropzone${invalid ? " is-invalid" : ""}`}
        style={{ marginBottom: 0 }}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); void take(event.dataTransfer.files[0]); }}
      >
        {hint}<br /><span style={{ fontSize: 11 }}>{t.dropOrClick}</span>
      </button>
      {value ? (
        <div className="doc-row">
          <img src={value} alt="" style={kind === "favicon" ? { width: 32, height: 32, objectFit: "contain", borderRadius: 6, background: "#fff" } : { width: 120, height: 68, objectFit: "cover", borderRadius: 8 }} />
          <div className="doc-name">{value.split("/").pop()}</div>
          <button type="button" className="icon-btn danger" onClick={() => onChange("")}>🗑️</button>
        </div>
      ) : null}
      {busy ? <BrandLoader label={t.loading} overlay /> : null}
    </div>
  );
}

function contentLocaleForJob(uiLocale: Locale, langs: Locale[] | undefined): Locale {
  if (langs?.includes(uiLocale)) return uiLocale;
  if (langs?.length) return langs[0];
  return uiLocale;
}

function JobEdit({ t, locale, id }: { t: T; locale: Locale; id: string }) {
  const [job, setJob] = useState<PublicJob | null>(null);
  const [editLocale, setEditLocale] = useState<Locale>(locale);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let ignore = false;
    setJob(null);
    setMissing(false);
    void (async () => {
      const firstRes = await fetch(`/api/recruiting/jobs/${encodeURIComponent(id)}?locale=${locale}`);
      const first = firstRes.ok ? await firstRes.json().catch(() => null) : null;
      if (ignore) return;
      if (!first?.job) {
        setMissing(true);
        return;
      }
      const langs = Array.isArray(first.job.langs) ? first.job.langs as Locale[] : [];
      const wanted = contentLocaleForJob(locale, langs);
      setEditLocale(wanted);
      if (wanted === locale) {
        setJob(first.job as PublicJob);
        return;
      }
      const secondRes = await fetch(`/api/recruiting/jobs/${encodeURIComponent(id)}?locale=${wanted}`);
      const second = secondRes.ok ? await secondRes.json().catch(() => null) : null;
      if (ignore) return;
      if (second?.job) setJob(second.job as PublicJob);
      else setMissing(true);
    })().catch(() => { if (!ignore) setMissing(true); });
    return () => { ignore = true; };
  }, [id, locale]);
  if (missing) return <p className="job-apply-missing">{t.saveFailed}</p>;
  if (!job) return <BrandLoader label={t.loading} />;
  if (job.format === "quiz") return <JobQuiz key={`${job.id}-${editLocale}`} t={t} locale={editLocale} job={job} />;
  return <JobCreate key={`${job.id}-${editLocale}`} t={t} locale={editLocale} job={job} />;
}

function JobCreate({ t, locale, job }: { t: T; locale: Locale; job?: PublicJob }) {
  const router = useRouter();
  const { jobs, setJobs } = useRecruiting();
  const departments = useHotelDepartments(locale);
  const descriptionRef = useRef<RichTextEditorHandle>(null);
  const autoMessageRef = useRef<RichTextEditorHandle>(null);
  const [title, setTitle] = useState(job?.title ?? "");
  const [dept, setDept] = useState(job?.departmentId ?? "");
  const [type, setType] = useState(job?.type ?? "fullOrPart");
  const [start, setStart] = useState(job?.start ?? "");
  const [notes, setNotes] = useState(job?.notes ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [autoMessage, setAutoMessage] = useState(job?.autoMessage ?? "");
  const [location, setLocation] = useState(job?.location ?? "");
  const [cvRequired, setCvRequired] = useState(job?.cvRequired ?? false);
  const [langs, setLangs] = useState<Record<Locale, boolean>>({ de: true, en: job?.langs.includes("en") ?? false, it: job?.langs.includes("it") ?? false });
  const [previewLang, setPreviewLang] = useState<Locale>(locale);
  const [generated, setGenerated] = useState(Boolean(job));
  const [image, setImage] = useState(job?.listingImage ?? "");
  const [logo, setLogo] = useState(job?.logoImage ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const typeLabel = type === "full" ? t.typeFull : type === "part" ? t.typePart : type === "apprentice" ? t.typeApprentice : t.typeFullOrPart;
  const missing = {
    title: !title.trim(),
    dept: !dept,
    start: !start.trim(),
    description: !htmlToPlain(description),
    location: !location.trim(),
    image: !image,
    logo: !logo,
  };
  const invalid = (field: keyof typeof missing) => showErrors && missing[field];
  const deptName = departments.find((item) => item.id === dept)?.name || "";
  function defaultDescription() {
    return `<p>${fill(t.lookingFor, { dept: deptName })}${notes ? ` – ${notes}` : ""}.</p>`;
  }
  function generate() {
    setGenerated(true);
    setPreviewLang(langs.de ? "de" : langs.en ? "en" : "it");
    if (!htmlToPlain(description)) setDescription(defaultDescription());
  }
  async function save(status: JobStatus) {
    const nextDescription = sanitizeJobHtml(descriptionRef.current?.getHtml() ?? description);
    const nextAutoMessage = sanitizeJobHtml(autoMessageRef.current?.getHtml() ?? autoMessage);
    setDescription(nextDescription);
    setAutoMessage(nextAutoMessage);
    setShowErrors(true);
    setError("");
    const nextMissing = {
      ...missing,
      description: !htmlToPlain(nextDescription),
    };
    if (Object.values(nextMissing).some(Boolean)) return;
    setBusy(true);
    try {
      const langsOn = (["de", "en", "it"] as Locale[]).filter((lang) => langs[lang]);
      const payload = {
        format: job?.format ?? "classic", status, title: title.trim(), departmentId: dept, workType: type,
        startFrom: start.trim() || t.immediately, notes, description: nextDescription,
        autoMessage: nextAutoMessage, location: location.trim(), cvRequired, languages: langsOn,
        listingImage: image, logoImage: logo, locale,
      };
      const res = await fetch(job ? `/api/recruiting/jobs/${job.id}` : "/api/recruiting/jobs", {
        method: job ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(t.saveFailed);
        setBusy(false);
        return;
      }
      if (data?.job) setJobs(job ? jobs.map((item) => item.id === data.job.id ? data.job : item) : [data.job, ...jobs]);
      router.push("/recruiting/jobs");
    } catch {
      setError(t.saveFailed);
      setBusy(false);
    }
  }
  return <>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <Back href="/recruiting/jobs" label={t.backJobs} />
      <ApplyPageLink slug={job?.slug} title={t.applyOpen} />
    </div>
    <div className="g2">
      <div>
        {job ? null : (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><div className="ct">{t.formatStep}</div></div>
          <div className="cb" style={{ display: "flex", gap: 12 }}>
            <div className="kb-card" style={{ flex: 1, borderColor: "var(--accent)" }}>
              <div className="kb-scope">{t.formScope}</div><div className="kb-name">{t.formName}</div><div className="kb-meta">{t.formMeta}</div>
            </div>
            <Link href="/recruiting/jobs/new/quiz" className="kb-card" style={{ flex: 1, textDecoration: "none", display: "block" }}>
              <div className="kb-scope">{t.quizScope}</div><div className="kb-name">{t.quizName}</div><div className="kb-meta">{t.quizMeta}</div>
            </Link>
          </div>
        </div>
        )}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><div className="ct">{t.basicsStep}</div></div>
          <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label><span className="field-lbl">{t.roleTitle}</span><input className={`field-input${invalid("title") ? " is-invalid" : ""}`} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.rolePlaceholder} /></label>
            <div className="field-row">
              <label><span className="field-lbl">{t.department}</span><select className={`field-select${invalid("dept") ? " is-invalid" : ""}`} value={dept} onChange={(event) => setDept(event.target.value)}>
                <option value=""></option>
                {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select></label>
              <label><span className="field-lbl">{t.workType}</span><select className="field-select" value={type} onChange={(event) => setType(event.target.value)}>
                <option value="fullOrPart">{t.typeFullOrPart}</option><option value="full">{t.typeFull}</option><option value="part">{t.typePart}</option><option value="apprentice">{t.typeApprentice}</option>
              </select></label>
            </div>
            <label><span className="field-lbl">{t.startFrom}</span><input className={`field-input${invalid("start") ? " is-invalid" : ""}`} value={start} onChange={(event) => setStart(event.target.value)} placeholder={t.startPlaceholder} /></label>
            <label><span className="field-lbl">{t.aiNotes}</span><input className="field-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t.aiNotesPlaceholder} /></label>
            <div>
              <span className="field-lbl">{t.jobDescription}</span>
              <RichTextEditor ref={descriptionRef} value={description} onChange={setDescription} placeholder={t.jobDescriptionPlaceholder} locale={locale} invalid={invalid("description")} />
            </div>
            <label><span className="field-lbl">{t.location}</span><input className={`field-input${invalid("location") ? " is-invalid" : ""}`} value={location} onChange={(event) => setLocation(event.target.value)} placeholder={t.locationPlaceholder} /></label>
            <div>
              <span className="field-lbl">{t.autoMessage}</span>
              <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 400, color: "var(--text3)" }}>{t.autoMessageHint}</p>
              <RichTextEditor ref={autoMessageRef} value={autoMessage} onChange={setAutoMessage} placeholder={t.autoMessagePlaceholder} locale={locale} />
            </div>
            <label className="quiz-check">
              <input type="checkbox" checked={cvRequired} onChange={(event) => setCvRequired(event.target.checked)} />
              {t.cvRequired}
            </label>
            <div>
              <span className="field-lbl">{t.listingLanguages}</span>
              <div style={{ display: "flex", gap: 14 }}>
                <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked disabled /> {t.german}</label>
                <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={langs.en} onChange={(event) => setLangs({ ...langs, en: event.target.checked })} /> {t.english}</label>
                <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={langs.it} onChange={(event) => setLangs({ ...langs, it: event.target.checked })} /> {t.italian}</label>
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={generate}>{t.generateAi}</button>
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">{t.imagesStep}</div></div>
          <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <ImageField t={t} label={t.listingImage} hint={t.uploadImage} value={image} onChange={setImage} invalid={invalid("image")} />
            </div>
            <div>
              <ImageField t={t} label={t.logo} hint={`${t.uploadLogo}`} value={logo} onChange={setLogo} invalid={invalid("logo")} kind="favicon" />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save("active")}>{t.publish}</button>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void save("draft")}>{t.saveDraft}</button>
            </div>
            {error ? <p className="job-apply-error">{error}</p> : null}
          </div>
        </div>
      </div>
      <div className="card">
        <div className="ch" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
          <div className="ct">{t.livePreview}</div>
          {generated ? <div style={{ display: "flex", gap: 6 }}>{(["de", "en", "it"] as Locale[]).filter((lang) => langs[lang]).map((lang) =>
            <button key={lang} type="button" className={`filter-btn ${previewLang === lang ? "active" : ""}`} onClick={() => setPreviewLang(lang)}>{lang.toUpperCase()}</button>)}</div> : null}
        </div>
        <div className="cb">
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>{t.formFormat} · {t.preview}</div>
          {image ? <img src={image} alt="" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 8, marginBottom: 12 }} /> : null}
          {logo ? <img src={logo} alt="" style={{ height: 36, marginBottom: 10, objectFit: "contain" }} /> : null}
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{title || t.newPosition}</div>
          <div style={{ fontSize: 12.5, color: "var(--text2)", marginBottom: 14 }}>{typeLabel} · {deptName}{location.trim() ? ` · ${location.trim()}` : ""} · {t.startLabel}: {start || t.immediately}</div>
          <div className="job-desc-preview" style={{ background: "var(--bg)", borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 13, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: sanitizeJobHtml(htmlToPlain(description) ? description : defaultDescription()) }} />
          {[t.formFields1, fill(t.formFields2, { dept: deptName }), cvRequired ? t.formFields3Required : t.formFields3].map((line) => <div className="doc-row" style={{ padding: "8px 12px" }} key={line}><div className="doc-name">{line}</div></div>)}
          <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void save("active")}>{t.publish}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void save("draft")}>{t.saveDraft}</button>
          </div>
          {error ? <p className="job-apply-error" style={{ marginTop: 10 }}>{error}</p> : null}
        </div>
      </div>
    </div>
    {busy ? <BrandLoader label={t.loading} overlay /> : null}
  </>;
}

function JobQuiz({ t, locale, job }: { t: T; locale: Locale; job?: PublicJob }) {
  const router = useRouter();
  const { jobs, setJobs } = useRecruiting();
  const departments = useHotelDepartments(locale);
  const [title, setTitle] = useState(job?.title ?? "");
  const [dept, setDept] = useState(job?.departmentId ?? "");
  const [pagesByLang, setPagesByLang] = useState<Record<Locale, QuizPage[]>>(() => ({
    de: Array.isArray(job?.quiz?.pagesByLang?.de) ? job.quiz.pagesByLang.de as QuizPage[] : createDefaultQuiz(getRecruitingMessages("de")),
    en: Array.isArray(job?.quiz?.pagesByLang?.en) ? job.quiz.pagesByLang.en as QuizPage[] : createDefaultQuiz(getRecruitingMessages("en")),
    it: Array.isArray(job?.quiz?.pagesByLang?.it) ? job.quiz.pagesByLang.it as QuizPage[] : createDefaultQuiz(getRecruitingMessages("it")),
  }));
  const [activePageId, setActivePageId] = useState(() => {
    const pages = Array.isArray(job?.quiz?.pagesByLang?.[locale]) ? job.quiz.pagesByLang[locale] as QuizPage[] : [];
    return pages[0]?.id ?? "advantages";
  });
  const [selectedElId, setSelectedElId] = useState<string | null>(null);
  const [footer, setFooter] = useState<QuizFooter>(job?.quiz?.footer ?? { impressumUrl: DEFAULT_FOOTER_URL, privacyUrl: DEFAULT_FOOTER_URL });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const quizPages = pagesByLang[locale];
  function setQuizPages(pages: QuizPage[]) {
    setPagesByLang({ ...pagesByLang, [locale]: pages });
  }
  async function save(status: JobStatus) {
    setShowErrors(true);
    setError("");
    if (!title.trim() || !dept) return;
    setBusy(true);
    try {
      const res = await fetch(job ? `/api/recruiting/jobs/${job.id}` : "/api/recruiting/jobs", {
        method: job ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: "quiz", status, title: title.trim(), departmentId: dept, workType: job?.type || "fullOrPart",
          startFrom: job?.start || t.immediately, notes: job?.notes || "", description: job?.description || "",
          autoMessage: job?.autoMessage || "", location: job?.location || "", cvRequired: job?.cvRequired === true,
          languages: job?.langs?.length ? job.langs : [locale], listingImage: job?.listingImage || "", logoImage: job?.logoImage || "",
          quiz: { footer, pagesByLang }, locale,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(t.saveFailed);
        setBusy(false);
        return;
      }
      if (data?.job) setJobs(job ? jobs.map((item) => item.id === data.job.id ? data.job : item) : [data.job, ...jobs]);
      router.push("/recruiting/jobs");
    } catch {
      setError(t.saveFailed);
      setBusy(false);
    }
  }
  return <>
    <div className="quiz-topbar">
      <Back href={job ? "/recruiting/jobs" : "/recruiting/jobs/new"} label={job ? t.backJobs : t.backToClassic} />
      <ApplyPageLink slug={job?.slug} title={t.applyOpen} />
      <input className={`field-input quiz-title-input${showErrors && !title.trim() ? " is-invalid" : ""}`} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.rolePlaceholder} aria-label={t.roleTitle} />
      <select className={`field-select${showErrors && !dept ? " is-invalid" : ""}`} value={dept} onChange={(event) => setDept(event.target.value)} aria-label={t.department} style={{ maxWidth: 220 }}>
        <option value=""></option>
        {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {error ? <span className="job-apply-error">{error}</span> : null}
    </div>
    <div className="g2 g2-quiz">
      <QuizToolsCard t={t} pages={quizPages} setPages={setQuizPages} activePageId={activePageId} setActivePageId={setActivePageId} selectedId={selectedElId} setSelectedId={setSelectedElId} footer={footer} setFooter={setFooter} />
      <QuizCanvasCard t={t} pages={quizPages} setPages={setQuizPages} activePageId={activePageId} setActivePageId={setActivePageId} selectedId={selectedElId} setSelectedId={setSelectedElId} footer={footer} setFooter={setFooter} onPublish={() => void save("active")} onDraft={() => void save("draft")} />
    </div>
    {busy ? <BrandLoader label={t.loading} overlay /> : null}
  </>;
}

function Applications({ t, locale }: { t: T; locale: Locale }) {
  const { applicants, setApplicants } = useRecruiting();
  const [filter, setFilter] = useState<"all" | AppStage>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    fetch(`/api/recruiting/applications?locale=${locale}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!ignore && Array.isArray(data?.applications)) setApplicants(data.applications); })
      .catch(() => undefined)
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [locale, setApplicants]);
  const rows = applicants.filter((item) => (filter === "all" || item.stage === filter) && `${item.name} ${item.role} ${t.depts[item.dept]}`.toLowerCase().includes(search.toLowerCase()));
  const filters: Array<["all" | AppStage, string]> = [["all", t.all], ["new", t.stageNew], ["offer", t.stageOffer], ["hired", t.stageHired], ["rejected", t.stageRejected], ["archived", t.stageArchived]];
  return <>
    <Back href="/recruiting" label={t.backRecruiting} />
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div className="filter-row" style={{ marginBottom: 0 }}>{filters.map(([key, label]) =>
        <button key={key} type="button" className={`filter-btn ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>{label}</button>)}</div>
      <input className="field-input" style={{ maxWidth: 220 }} placeholder={t.search} value={search} onChange={(event) => setSearch(event.target.value)} />
      <Link href="/recruiting/applications/new" className="btn btn-primary" style={{ marginLeft: "auto" }}>{t.addApplication}</Link>
    </div>
    <div className="card" style={{ overflowX: "auto" }}>
      <table className="bud-table"><thead><tr><th>{t.colName}</th><th>{t.colDepartment}</th><th>{t.colAiScore}</th><th>{t.colAiRec}</th><th>{t.colStage}</th><th>{t.colDate}</th><th style={{ textAlign: "right" }}>{t.colActions}</th></tr></thead>
        <tbody>{rows.map((item) => <tr key={item.id} style={{ cursor: "pointer" }}>
          <td><Link href={`/recruiting/applications/${item.id}`}>{item.name}</Link></td>
          <td>{t.depts[item.dept]}</td>
          <td><span className={`chip ${suggestClass(item.suggestion)}`}>{item.score}</span></td>
          <td><span className={`chip ${suggestClass(item.suggestion)}`}>{suggestLabel(t, item.suggestion)}</span></td>
          <td>{stageBadge(t, item.stage)}</td>
          <td>{item.dateDisplay || item.date}</td>
          <td style={{ textAlign: "right" }}><Link href={`/recruiting/applications/${item.id}`} className="icon-btn">👁️</Link></td>
        </tr>)}</tbody>
      </table>
    </div>
    {loading ? <BrandLoader label={t.loading} overlay /> : null}
  </>;
}

function ApplicationCreate({ t, locale }: { t: T; locale: Locale }) {
  const router = useRouter();
  const { applicants, setApplicants, jobs, setJobs } = useRecruiting();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobId, setJobId] = useState("");
  const [message, setMessage] = useState("");
  const [cv, setCv] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const cvInputRef = useRef<HTMLInputElement>(null);
  function takeCv(file?: File | null) {
    if (!file) return;
    const ok = /\.(pdf|doc|docx)$/i.test(file.name) || ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(file.type);
    if (!ok) return;
    setCv(file.name);
  }
  useEffect(() => {
    let ignore = false;
    setLoadingJobs(true);
    fetch(`/api/recruiting/jobs?locale=${locale}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!ignore && Array.isArray(data?.jobs)) setJobs(data.jobs); })
      .catch(() => undefined)
      .finally(() => { if (!ignore) setLoadingJobs(false); });
    return () => { ignore = true; };
  }, [locale, setJobs]);
  const openJobs = jobs.filter((job) => job.status === "active" || job.status === "draft");
  const missing = { first: !first.trim(), last: !last.trim(), jobId: !jobId };
  async function save(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    setError("");
    if (Object.values(missing).some(Boolean)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/recruiting/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: first.trim(), lastName: last.trim(), email: email.trim(), phone: phone.trim(),
          jobId, message: message.trim(), cvFileName: cv, locale,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.application) {
        setError(t.saveFailed);
        setBusy(false);
        return;
      }
      setApplicants([data.application as Applicant, ...applicants.filter((item) => item.id !== data.application.id)]);
      router.push(`/recruiting/applications/${data.application.id}`);
    } catch {
      setError(t.saveFailed);
      setBusy(false);
    }
  }
  return <>
    <Back href="/recruiting/applications" label={t.backApplications} />
    <form className="card" style={{ maxWidth: 460 }} onSubmit={(event) => void save(event)} noValidate>
      <div className="ch"><div className="ct">{t.applicationCreateTitle}</div></div>
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="field-row">
          <label><span className="field-lbl">{t.firstName}</span><input className={`field-input${showErrors && missing.first ? " is-invalid" : ""}`} value={first} onChange={(event) => setFirst(event.target.value)} placeholder={t.firstNamePh} /></label>
          <label><span className="field-lbl">{t.lastName}</span><input className={`field-input${showErrors && missing.last ? " is-invalid" : ""}`} value={last} onChange={(event) => setLast(event.target.value)} placeholder={t.lastNamePh} /></label>
        </div>
        <label><span className="field-lbl">{t.email}</span><input className="field-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
        <label><span className="field-lbl">{t.phone}</span><input className="field-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+39 ..." /></label>
        <label><span className="field-lbl">{t.selectJob}</span>
          <select className={`field-select${showErrors && missing.jobId ? " is-invalid" : ""}`} value={jobId} onChange={(event) => setJobId(event.target.value)}>
            <option value=""></option>
            {openJobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
          </select>
        </label>
        <label><span className="field-lbl">{t.message}</span><textarea className="field-input" style={{ minHeight: 80, resize: "vertical" }} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t.optional} /></label>
        <div>
          <span className="field-lbl">{t.cv} ({t.optional})</span>
          <input
            ref={cvInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            hidden
            onChange={(event) => { takeCv(event.target.files?.[0]); event.target.value = ""; }}
          />
          <button
            type="button"
            className="dropzone"
            style={{ marginBottom: 0 }}
            onClick={() => cvInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); takeCv(event.dataTransfer.files[0]); }}
          >
            {t.uploadCv}<br /><span style={{ fontSize: 11 }}>{t.clickOrDropFile}</span>
          </button>
          {cv ? <div className="doc-row"><div className="doc-ic">📄</div><div className="doc-name">{cv}</div><button type="button" className="icon-btn danger" onClick={() => setCv("")}>🗑️</button></div> : null}
        </div>
        {error ? <p className="job-apply-error">{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>{t.save}</button>
      </div>
    </form>
    {busy || loadingJobs ? <BrandLoader label={t.loading} overlay /> : null}
  </>;
}

function ApplicationDetail({ t, locale, id }: { t: T; locale: Locale; id: string }) {
  const router = useRouter();
  const { applicants, setApplicants, employees, setEmployees } = useRecruiting();
  const [item, setItem] = useState<Applicant | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [tag, setTag] = useState("");
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [notesOk, setNotesOk] = useState("");
  const [actionOk, setActionOk] = useState("");
  const [authorName, setAuthorName] = useState("Team");
  useEffect(() => {
    fetch("/api/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim();
        if (name) setAuthorName(name);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setMissing(false);
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      setMissing(true);
      setLoading(false);
      return;
    }
    fetch(`/api/recruiting/applications/${encodeURIComponent(id)}?locale=${locale}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ignore) return;
        if (data?.application) {
          const next = data.application as Applicant;
          setItem(next);
          setApplicants([next, ...applicants.filter((row) => row.id !== next.id)]);
        } else setMissing(true);
      })
      .catch(() => { if (!ignore) setMissing(true); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per id/locale
  }, [id, locale]);
  function update(patch: Partial<Applicant>) {
    if (!item) return;
    const next = { ...item, ...patch };
    setItem(next);
    setApplicants(applicants.some((row) => row.id === id)
      ? applicants.map((row) => row.id === id ? next : row)
      : [next, ...applicants]);
  }
  async function persistNotes(nextTags: string[], nextComments: Applicant["comments"]) {
    setNotesBusy(true);
    setNotesError("");
    setNotesOk("");
    update({ tags: nextTags, comments: nextComments });
    try {
      const res = await fetch(`/api/recruiting/applications/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: nextTags, comments: nextComments, locale }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.application) {
        setNotesError(t.notesSaveFailed);
        setNotesBusy(false);
        return;
      }
      setItem(data.application as Applicant);
      setApplicants(applicants.map((row) => row.id === id ? data.application as Applicant : row));
      setNotesOk(t.notesSaved);
    } catch {
      setNotesError(t.notesSaveFailed);
    }
    setNotesBusy(false);
  }
  async function addTag() {
    if (!item || !tag.trim()) return;
    const nextTags = [...item.tags, tag.trim()];
    setTag("");
    await persistNotes(nextTags, item.comments);
  }
  async function removeTag(index: number) {
    if (!item) return;
    await persistNotes(item.tags.filter((_, i) => i !== index), item.comments);
  }
  async function saveComment() {
    if (!item) return;
    if (!comment.trim()) { alert(t.enterComment); return; }
    const nextComments = [...item.comments, { text: comment.trim(), author: authorName, date: new Date().toLocaleDateString() }];
    setComment("");
    await persistNotes(item.tags, nextComments);
  }
  async function setStage(stage: AppStage) {
    if (!item) return;
    setActionOk("");
    const today = new Date().toLocaleDateString();
    const patch: Partial<Applicant> = {
      stage,
      dateDisplay: stage === "offer" ? fill(t.offerOn, { date: today }) : item.dateDisplay,
      suggestion: stage === "archived" ? "archived" : item.suggestion === "archived" ? "needsReview" : item.suggestion,
    };
    update(patch);
    const res = await fetch(`/api/recruiting/applications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, locale }),
    }).catch(() => null);
    const data = res && res.ok ? await res.json().catch(() => null) : null;
    if (data?.application) {
      setItem(data.application as Applicant);
      setApplicants(applicants.map((row) => row.id === id ? data.application as Applicant : row));
    }
    const message = stage === "offer" ? t.offerSent
      : stage === "rejected" ? t.rejectSent
      : stage === "archived" ? t.archivedApp
      : t.unarchivedApp;
    setActionOk(fill(message, { name: item.name }));
  }
  function convert() {
    if (!item) return;
    if (employees.some((row) => row.id === id)) { alert(fill(t.alreadyEmployee, { name: item.name })); router.push(`/recruiting/employees/${id}`); return; }
    const next: Employee = { id, initials: item.initials, name: item.name, dept: item.dept, status: "active", reason: "", email: item.email, phone: item.phone, taxId: t.stillNeeded, birthdate: "", birthplace: t.stillNeeded, employment: new Date().toLocaleDateString(), comments: fill(t.fromApplication, { date: item.date }), tags: [...item.tags], certificates: [] };
    setEmployees([next, ...employees]);
    alert(fill(t.converted, { name: item.name }));
    router.push(`/recruiting/employees/${id}`);
  }
  if (loading) return <BrandLoader label={t.loading} />;
  if (missing || !item) return <><Back href="/recruiting/applications" label={t.backApplications} /><p className="job-apply-missing">{t.applicationMissing}</p></>;
  const bars: Array<[string, number]> = [[t.social, item.competencies.social], [t.professional, item.competencies.professional], [t.methodical, item.competencies.methodical], [t.personal, item.competencies.personal]];
  return <>
    <Back href="/recruiting/applications" label={t.backApplications} />
    <div className="g2">
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="cb" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div className="ad-photo">{item.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{item.name}</div>
                <span className={`chip ${suggestClass(item.suggestion)}`}>{item.score} · {suggestLabel(t, item.suggestion)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text2)" }}>{item.role} · {t.depts[item.dept]}</div>
            </div>
          </div>
          <div className="cb" style={{ borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
            <Field label={t.email} value={item.email} /><Field label={t.phone} value={item.phone} />
            <Field label={t.bestTime} value={item.bestTime} /><Field label={t.appliedOn} value={item.date} />
            <Field label={t.source} value={item.source} />
            <div><div className="field-lbl" style={{ marginBottom: 2 }}>{t.cv}</div><div style={{ fontSize: 13 }}>{item.cv ? fill(t.viewCv, { file: item.cv }) : t.noCv}</div></div>
          </div>
          <div className="cb" style={{ borderTop: "1px solid var(--border)" }}><div className="field-lbl" style={{ marginBottom: 6 }}>{t.message}</div><div style={{ fontSize: 13, lineHeight: 1.6 }}>{item.message || "–"}</div></div>
        </div>
        {item.source.toLowerCase().includes("quiz") || (item.answers && item.answers.length) ? (
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="ch"><div className="ct">{t.quizAnswers}</div><div style={{ fontSize: 11.5, color: "var(--text2)", fontWeight: 400 }}>{t.quizAnswersHint}</div></div>
            <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {item.answers?.length ? item.answers.map((answer, index) => (
                <div key={`${answer.prompt}-${index}`} style={{ background: "var(--bg)", borderRadius: 8, padding: "12px 14px" }}>
                  {answer.pageName ? <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, marginBottom: 4 }}>{answer.pageName}</div> : null}
                  <div className="field-lbl" style={{ marginBottom: 4 }}>{answer.prompt}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.5, fontWeight: 600 }}>{answer.value}</div>
                </div>
              )) : <div style={{ fontSize: 13, color: "var(--text3)" }}>{t.quizNoAnswers}</div>}
            </div>
          </div>
        ) : null}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><div className="ct">{t.competencies}</div><div style={{ fontSize: 11.5, color: "var(--text2)", fontWeight: 400 }}>{t.competenciesHint}</div></div>
          <div className="cb" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {bars.map(([label, value]) => <div key={label}><div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{label}</div><div className="score-bar"><div className={`score-fill ${value >= 75 ? "bar-g" : value >= 50 ? "bar-a" : "bar-r"}`} style={{ width: `${value}%` }} /></div></div>)}
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">{t.notesTags}</div><div style={{ fontSize: 11.5, color: "var(--text2)", fontWeight: 400 }}>{t.notesHint}</div></div>
          <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label><span className="field-lbl">{t.addComment}</span><textarea className="field-input" style={{ minHeight: 70, resize: "vertical" }} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={t.commentPlaceholder} /></label>
            <label><span className="field-lbl">{t.tags}</span>
              <input className="field-input" value={tag} placeholder={t.tagsPlaceholder} onChange={(event) => setTag(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addTag(); } }} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{item.tags.map((entry, index) => <span className="chip chip-n" key={`${entry}-${index}`}>{entry} <button type="button" disabled={notesBusy} onClick={() => void removeTag(index)}>✕</button></span>)}</div>
            </label>
            {item.comments.map((entry, index) => <div key={`${entry.date}-${index}`} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px" }}><div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{entry.text}</div><div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{entry.author} · {entry.date}</div></div>)}
            {notesError ? <p className="job-apply-error">{notesError}</p> : null}
            {notesOk ? <p style={{ margin: 0, fontSize: 12.5, color: "var(--green)" }}>{notesOk}</p> : null}
            <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={notesBusy} onClick={() => void saveComment()}>{t.save}</button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="ch"><div className="ct">{t.actions}</div></div>
        <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>{stageBadge(t, item.stage)}</div>
          <button type="button" className="btn btn-primary" onClick={() => void setStage("offer")}>{t.sendOffer}</button>
          <button type="button" className="btn btn-ghost" onClick={() => void setStage("rejected")}>{t.reject}</button>
          <button type="button" className="btn btn-ghost" onClick={convert}>{t.makeEmployee}</button>
          {item.stage === "archived"
            ? <button type="button" className="btn btn-ghost" onClick={() => void setStage("new")}>{t.unarchive}</button>
            : <button type="button" className="btn btn-ghost" onClick={() => void setStage("archived")}>{t.archive}</button>}
          {actionOk ? <p style={{ margin: 0, fontSize: 12.5, color: "var(--green)", lineHeight: 1.4 }}>{actionOk}</p> : null}
        </div>
      </div>
    </div>
    {notesBusy ? <BrandLoader label={t.loading} overlay /> : null}
  </>;
}

function Employees({ t }: { t: T }) {
  const { employees } = useRecruiting();
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const rows = employees.filter((item) => (filter === "all" || item.status === filter) && item.name.toLowerCase().includes(search.toLowerCase()));
  return <>
    <Back href="/recruiting" label={t.backRecruiting} />
    <p style={{ fontSize: 12, color: "var(--text2)", marginBottom: 14, lineHeight: 1.5 }}>{t.employeesIntro}</p>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
      <div className="filter-row" style={{ marginBottom: 0 }}>
        {([["all", t.all], ["active", t.active], ["inactive", t.inactive]] as const).map(([key, label]) =>
          <button key={key} type="button" className={`filter-btn ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>{label}</button>)}
      </div>
      <input className="field-input" style={{ maxWidth: 220 }} placeholder={t.search} value={search} onChange={(event) => setSearch(event.target.value)} />
      <Link href="/recruiting/employees/new" className="btn btn-primary" style={{ marginLeft: "auto" }}>{t.addEmployee}</Link>
    </div>
    <div className="card" style={{ overflowX: "auto" }}>
      <table className="bud-table"><thead><tr><th>{t.colEmployee}</th><th>{t.colDepartment}</th><th>{t.colStatus}</th><th>{t.colReason}</th><th>{t.colEmployedSince}</th><th>{t.colSafety}</th><th style={{ textAlign: "right" }}>{t.colActions}</th></tr></thead>
        <tbody>{rows.map((item) => {
          const cert = item.certificates[0];
          const chip = !cert ? "chip-n" : cert.status === "valid" ? "chip-g" : cert.status === "expiring" ? "chip-a" : "chip-r";
          const certLabel = !cert ? t.noCertsYet : cert.status === "valid" ? t.valid : cert.status === "expiring" ? t.expiring : t.expired;
          return <tr key={item.id} style={{ cursor: "pointer" }}>
            <td><Link href={`/recruiting/employees/${item.id}`} className="u-row-name"><span className="u-av">{item.initials}</span>{item.name}</Link></td>
            <td>{t.depts[item.dept]}</td>
            <td><span className={`status-pill ${item.status === "active" ? "active" : "inactive"}`}>{item.status === "active" ? t.active : t.inactive}</span></td>
            <td>{item.reason === "pension" ? t.pension : item.reason === "resignation" ? t.resignation : t.none}</td>
            <td>{item.employment}</td>
            <td><span className={`chip ${chip}`}>{certLabel}</span></td>
            <td style={{ textAlign: "right" }}><Link href={`/recruiting/employees/${item.id}`} className="icon-btn">👁️</Link></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </>;
}

function EmployeeCreate({ t }: { t: T }) {
  const router = useRouter();
  const { employees, setEmployees } = useRecruiting();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [dept, setDept] = useState<DeptId>("reception");
  function save(event: FormEvent) {
    event.preventDefault();
    if (!first.trim() || !last.trim()) { alert(t.requiredName); return; }
    const id = `emp_${Date.now()}`;
    const name = `${first.trim()} ${last.trim()}`;
    setEmployees([{ id, initials: `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase(), name, dept, status: "active", reason: "", email: "–", phone: "–", taxId: t.stillNeeded, birthdate: "", birthplace: t.stillNeeded, employment: new Date().toLocaleDateString(), comments: "", tags: [], certificates: [] }, ...employees]);
    router.push(`/recruiting/employees/${id}`);
  }
  return <>
    <Back href="/recruiting/employees" label={t.backEmployees} />
    <form className="card" style={{ maxWidth: 460 }} onSubmit={save}>
      <div className="ch"><div className="ct">{t.employeeCreateTitle}</div></div>
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="field-row">
          <label><span className="field-lbl">{t.firstName}</span><input className="field-input" value={first} onChange={(event) => setFirst(event.target.value)} /></label>
          <label><span className="field-lbl">{t.lastName}</span><input className="field-input" value={last} onChange={(event) => setLast(event.target.value)} /></label>
        </div>
        <label><span className="field-lbl">{t.department}</span><select className="field-select" value={dept} onChange={(event) => setDept(event.target.value as DeptId)}>{deptIds.map((item) => <option key={item} value={item}>{t.depts[item]}</option>)}</select></label>
        <button type="submit" className="btn btn-primary">{t.save}</button>
      </div>
    </form>
  </>;
}

function EmployeeDetail({ t, id }: { t: T; id: string }) {
  const { employees, setEmployees } = useRecruiting();
  const item = employees.find((row) => row.id === id);
  if (!item) return <><Back href="/recruiting/employees" label={t.backEmployees} /><p>{t.loading}</p></>;
  return <>
    <Back href="/recruiting/employees" label={t.backEmployees} />
    <div className="g2">
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="cb" style={{ display: "flex", gap: 16 }}>
            <div className="ad-photo">{item.initials}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{item.name}</div>
                <span className={`status-pill ${item.status === "active" ? "active" : "inactive"}`}>{item.status === "active" ? t.active : t.inactive}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text2)" }}>{t.depts[item.dept]}</div>
            </div>
          </div>
          <div className="cb" style={{ borderTop: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
            <Field label={t.email} value={item.email} /><Field label={t.phone} value={item.phone} />
            <Field label={t.taxId} value={item.taxId} /><Field label={t.birthdate} value={item.birthdate || t.none} />
            <Field label={t.birthplace} value={item.birthplace} /><Field label={t.employedFromTo} value={item.employment} />
          </div>
          <div className="cb" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="field-lbl" style={{ marginBottom: 6 }}>{t.comments}</div>
            <div style={{ fontSize: 13, marginBottom: 10 }}>{item.comments || t.none}</div>
            <div className="field-lbl" style={{ marginBottom: 6 }}>{t.tags}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{item.tags.map((entry) => <span className="chip chip-n" key={entry}>{entry}</span>)}</div>
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">{t.safetyCerts}</div></div>
          <div className="cb">{item.certificates.length ? item.certificates.map((cert) => <div className="doc-row" key={`${cert.name}-${cert.expires}`}>
            <div className="doc-ic">🦺</div>
            <div style={{ flex: 1 }}><div className="doc-name">{t[cert.name]}</div><div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>{fill(t.completedOn, { date: cert.completed, until: cert.expires })}</div></div>
            <span className={`chip ${cert.status === "valid" ? "chip-g" : cert.status === "expiring" ? "chip-a" : "chip-r"}`}>{cert.status === "valid" ? t.valid : cert.status === "expiring" ? t.expiring : t.expired}</span>
          </div>) : <div style={{ fontSize: 12.5, color: "var(--text3)" }}>{t.noTrainings}</div>}</div>
        </div>
      </div>
      <div className="card">
        <div className="ch"><div className="ct">{t.actions}</div></div>
        <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" className="btn btn-primary" onClick={() => alert(t.editDemo)}>{t.editFile}</button>
          <button type="button" className="btn btn-ghost" onClick={() => alert(t.trainingDemo)}>{t.addTraining}</button>
          <button type="button" className="btn btn-ghost" style={{ color: "var(--red)" }} onClick={() => { setEmployees(employees.map((row) => row.id === id ? { ...row, status: "inactive" } : row)); alert(t.inactiveDemo); }}>{t.markInactive}</button>
        </div>
      </div>
    </div>
  </>;
}

function EmailSettings({ t }: { t: T }) {
  const [subdomain, setSubdomain] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [logo, setLogo] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    fetch("/api/recruiting/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ignore || !data?.settings) return;
        setSubdomain(typeof data.settings.subdomain === "string" ? data.settings.subdomain : "");
        setReplyEmail(typeof data.settings.replyEmail === "string" ? data.settings.replyEmail : "");
        setLogo(typeof data.settings.emailLogo === "string" ? data.settings.emailLogo : "");
      })
      .catch(() => undefined)
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);
  async function save() {
    setSaving(true);
    setNotice("");
    setError("");
    const res = await fetch("/api/recruiting/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subdomain, replyEmail, emailLogo: logo }),
    }).catch(() => null);
    setSaving(false);
    if (!res) { setError(t.settingsSaveFailed); return; }
    if (res.status === 409) { setError(t.subdomainTaken); return; }
    if (res.status === 400) {
      const data = await res.json().catch(() => null);
      setError(data?.error === "INVALID_SUBDOMAIN" ? t.subdomainInvalid : data?.error === "INVALID_EMAIL" ? t.replyEmailInvalid : t.settingsSaveFailed);
      return;
    }
    if (!res.ok) { setError(t.settingsSaveFailed); return; }
    const data = await res.json().catch(() => null);
    if (data?.settings) {
      setSubdomain(data.settings.subdomain ?? "");
      setReplyEmail(data.settings.replyEmail ?? "");
      setLogo(data.settings.emailLogo ?? "");
    }
    setNotice(t.settingsSaved);
  }
  return <>
    <Back href="/recruiting" label={t.backRecruiting} />
    <div className="card">
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <label>
          <span className="field-lbl">{t.subdomain}</span>
          <input className="field-input" value={subdomain} onChange={(event) => setSubdomain(event.target.value)} placeholder={t.subdomainPlaceholder} />
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 6 }}>{t.subdomainHint}</div>
        </label>
        <label>
          <span className="field-lbl">{t.replyEmail}</span>
          <input className="field-input" type="email" value={replyEmail} onChange={(event) => setReplyEmail(event.target.value)} placeholder={t.replyEmailPlaceholder} />
          <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 6 }}>{t.replyEmailHint}</div>
        </label>
        <ImageField t={t} label={t.emailLogo} hint={t.emailLogoHint} value={logo} onChange={setLogo} />
        {error ? <div style={{ fontSize: 12.5, color: "var(--danger, #c0392b)" }}>{error}</div> : null}
        {notice ? <div style={{ fontSize: 12.5, color: "var(--accent)" }}>{notice}</div> : null}
        <button type="button" className="btn btn-primary" disabled={saving || loading} onClick={() => void save()}>{t.save}</button>
      </div>
    </div>
    {loading || saving ? <BrandLoader label={t.loading} overlay /> : null}
  </>;
}

function Emails({ t, locale }: { t: T; locale: Locale }) {
  const [emails, setEmails] = useState<EmailTemplates | null>(null);
  const [auto, setAuto] = useState<Record<EmailCat, boolean>>({ received: true, offer: true, reject: true });
  const [cat, setCat] = useState<EmailCat>("received");
  const [lang, setLang] = useState<Locale>(locale);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const current = emails?.[cat]?.[lang] ?? { subject: "", body: "" };
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    fetch("/api/recruiting/emails")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ignore) return;
        if (!data?.templates) { setError(t.templateLoadFailed); return; }
        setEmails(data.templates);
        if (data.auto) setAuto(data.auto);
      })
      .catch(() => { if (!ignore) setError(t.templateLoadFailed); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [t.templateLoadFailed]);
  function change(field: "subject" | "body", value: string) {
    if (!emails) return;
    setNotice("");
    setEmails({ ...emails, [cat]: { ...emails[cat], [lang]: { ...current, [field]: value } } });
  }
  async function save() {
    if (!emails) return;
    setSaving(true);
    setNotice("");
    setError("");
    const res = await fetch("/api/recruiting/emails", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templates: emails, auto }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) { setError(t.templateSaveFailed); return; }
    const data = await res.json().catch(() => null);
    if (data?.templates) setEmails(data.templates);
    if (data?.auto) setAuto(data.auto);
    setNotice(t.templateSaved);
  }
  return <>
    <Back href="/recruiting" label={t.backRecruiting} />
    <div className="card">
      <div className="ch" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
        <div className="bud-tab-row">
          {([["received", t.catReceived], ["offer", t.catOffer], ["reject", t.catReject]] as const).map(([key, label]) =>
            <button key={key} type="button" className={`bud-tab ${cat === key ? "active" : ""}`} onClick={() => setCat(key)}>{label}</button>)}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {(["de", "en", "it"] as Locale[]).map((item) =>
            <button key={item} type="button" className={`filter-btn ${lang === item ? "active" : ""}`} onClick={() => setLang(item)}>{item.toUpperCase()}</button>)}
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }} title={t.autoEmailHint}>
            <input type="checkbox" checked={auto[cat]} onChange={(event) => { setNotice(""); setAuto({ ...auto, [cat]: event.target.checked }); }} />
            {t.autoEmail}
          </label>
        </div>
      </div>
      <div className="cb">
        <div style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 10 }}>{t.placeholders} <code>{"{{name}}"}</code> <code>{"{{job_name}}"}</code> <code>{"{{hotel_name}}"}</code> <code>{"{{hotel_email}}"}</code> <code>{"{{logo}}"}</code></div>
        <label><span className="field-lbl">{t.subject}</span><input className="field-input" style={{ marginBottom: 12 }} value={current.subject} onChange={(event) => change("subject", event.target.value)} /></label>
        <label><span className="field-lbl">{t.body}</span><textarea className="field-input" style={{ minHeight: 180, resize: "vertical", lineHeight: 1.6 }} value={current.body} onChange={(event) => change("body", event.target.value)} /></label>
        {error ? <div style={{ fontSize: 12.5, color: "var(--danger, #c0392b)", marginTop: 12 }}>{error}</div> : null}
        {notice ? <div style={{ fontSize: 12.5, color: "var(--accent)", marginTop: 12 }}>{notice}</div> : null}
        <button type="button" className="btn btn-primary" style={{ marginTop: 14 }} disabled={saving || loading || !emails} onClick={() => void save()}>{t.save}</button>
      </div>
    </div>
    {loading || saving ? <BrandLoader label={t.loading} overlay /> : null}
  </>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><div className="field-lbl" style={{ marginBottom: 2 }}>{label}</div><div style={{ fontSize: 13 }}>{value}</div></div>;
}

function suggestClass(suggestion: Applicant["suggestion"]) {
  if (suggestion === "recommended") return "chip-g";
  if (suggestion === "notAFit") return "chip-r";
  if (suggestion === "manualAdded" || suggestion === "archived") return "chip-n";
  return "chip-a";
}

function suggestLabel(t: T, suggestion: Applicant["suggestion"]) {
  if (suggestion === "recommended") return t.recommended;
  if (suggestion === "possible") return t.possible;
  if (suggestion === "needsReview") return t.needsReview;
  if (suggestion === "notAFit") return t.notAFit;
  if (suggestion === "archived") return t.stageArchived;
  return t.manualAdded;
}

function stageBadge(t: T, stage: AppStage) {
  const label = stage === "new" ? t.stageNew : stage === "invited" ? t.stageInvited : stage === "offer" ? t.stageOffer : stage === "hired" ? t.stageHired : stage === "rejected" ? t.stageRejected : t.stageArchived;
  const cls = stage === "new" ? "status-pill active" : stage === "invited" ? "chip chip-b" : stage === "offer" ? "chip chip-a" : stage === "hired" ? "chip chip-g" : "status-pill inactive";
  return <span className={cls}>{label}</span>;
}

function buildReminders(employees: Employee[], t: T) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const items: Array<{ icon: string; cls: string; title: string; meta: string }> = [];
  for (const employee of employees) {
    if (employee.status !== "active") continue;
    if (employee.birthdate) {
      const [, month, day] = employee.birthdate.split("-").map(Number);
      const next = new Date(start.getFullYear(), (month ?? 1) - 1, day ?? 1);
      let diff = Math.round((next.getTime() - start.getTime()) / 86400000);
      if (diff < 0) diff += 365;
      if (diff >= 0 && diff <= 7) items.push({ icon: "🎂", cls: "p", title: diff === 0 ? fill(t.birthdayToday, { name: employee.name }) : fill(t.birthdayIn, { name: employee.name, n: diff }), meta: t.depts[employee.dept] });
    }
    for (const cert of employee.certificates) {
      if (cert.status === "expiring") items.push({ icon: "⚠️", cls: "a", title: t.certExpiring, meta: fill(t.validUntil, { name: employee.name, date: cert.expires }) });
      if (cert.status === "expired") items.push({ icon: "🚫", cls: "r", title: t.certExpired, meta: fill(t.wasValidUntil, { name: employee.name, date: cert.expires }) });
    }
  }
  return items;
}
