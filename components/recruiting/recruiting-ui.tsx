"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { AppShell } from "../dashboard/app-shell";
import { useI18n } from "../i18n/i18n-provider";
import { fill, getRecruitingMessages, type DeptId, type RecruitingMessages } from "../../lib/i18n/recruiting-messages";
import type { Locale } from "../../lib/i18n/dictionaries";
import { deptIds, langFlags, type Applicant, type AppStage, type EmailCat, type Employee, type Job, type JobStatus } from "../../lib/recruiting/preview-data";
import { useRecruiting } from "./recruiting-provider";
import { createDefaultQuiz, DEFAULT_FOOTER_URL, QuizCanvasCard, QuizToolsCard, type QuizFooter, type QuizPage } from "./quiz-builder";

export type RecruitingView =
  | "hub" | "jobs" | "job-create" | "job-quiz" | "applications" | "application-create" | "application-detail"
  | "employees" | "employee-create" | "employee-detail" | "emails";

type T = RecruitingMessages;

export function RecruitingUI({ view, id = "" }: { view: RecruitingView; id?: string }) {
  const { locale } = useI18n();
  const t = getRecruitingMessages(locale);
  const titles: Record<RecruitingView, string> = {
    hub: t.title, jobs: t.jobsTitle, "job-create": t.jobCreateTitle, "job-quiz": t.quizName, applications: t.applicationsTitle,
    "application-create": t.applicationCreateTitle, "application-detail": t.applicationDetailTitle,
    employees: t.employeesTitle, "employee-create": t.employeeCreateTitle, "employee-detail": t.employeeDetailTitle, emails: t.emailsTitle,
  };
  return <AppShell activeItem="recruiting" pageTitle={titles[view]}>
    <main className={`qf-dashboard ${view === "job-quiz" ? "qf-dashboard-sticky" : ""}`}>
      {view === "hub" ? <Hub t={t} /> : null}
      {view === "jobs" ? <Jobs t={t} /> : null}
      {view === "job-create" ? <JobCreate t={t} locale={locale} /> : null}
      {view === "job-quiz" ? <JobQuiz t={t} locale={locale} /> : null}
      {view === "applications" ? <Applications t={t} /> : null}
      {view === "application-create" ? <ApplicationCreate t={t} /> : null}
      {view === "application-detail" ? <ApplicationDetail t={t} id={id} /> : null}
      {view === "employees" ? <Employees t={t} /> : null}
      {view === "employee-create" ? <EmployeeCreate t={t} /> : null}
      {view === "employee-detail" ? <EmployeeDetail t={t} id={id} /> : null}
      {view === "emails" ? <Emails t={t} locale={locale} /> : null}
    </main>
  </AppShell>;
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

function Jobs({ t }: { t: T }) {
  const { jobs, setJobs } = useRecruiting();
  const [filter, setFilter] = useState<"all" | JobStatus>("all");
  const [search, setSearch] = useState("");
  const clicks = jobs.reduce((sum, job) => sum + job.clicks, 0);
  const apps = jobs.reduce((sum, job) => sum + job.apps, 0);
  const best = [...jobs].sort((a, b) => parseFloat(b.conv) - parseFloat(a.conv))[0];
  const rows = jobs.filter((job) => (filter === "all" || job.status === filter) && job.title.toLowerCase().includes(search.toLowerCase()));
  const statusLabel = (status: JobStatus) => status === "active" ? t.active : status === "draft" ? t.draft : t.archived;
  function toggleArchive(id: string) {
    setJobs(jobs.map((job) => job.id === id ? { ...job, status: job.status === "archived" ? "active" : "archived" } : job));
  }
  return <>
    <Back href="/recruiting" label={t.backRecruiting} />
    <div className="kpi-row" style={{ marginBottom: 14 }}>
      <div className="kpi"><div className="kpi-lbl">{t.clicksTotal}</div><div className="kpi-val">{clicks}</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.appsTotal}</div><div className="kpi-val" style={{ color: "var(--accent)" }}>{apps}</div></div>
      <div className="kpi"><div className="kpi-lbl">{t.avgConversion}</div><div className="kpi-val">2.4<span>%</span></div></div>
      <div className="kpi"><div className="kpi-lbl">{t.bestListing}</div><div className="kpi-val" style={{ fontSize: 15 }}>{best?.title.split(" ")[0]}<span style={{ display: "block", fontSize: 11, color: "var(--text2)", fontWeight: 400 }}>{best?.conv} {t.conversion}</span></div></div>
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
          <td>{job.title}</td><td>{job.langs.map((lang) => langFlags[lang]).join("")}</td><td>{t.depts[job.dept]}</td>
          <td><span className={`status-pill ${job.status === "active" ? "active" : "inactive"}`}>{statusLabel(job.status)}</span></td>
          <td>{job.clicks || "–"}</td><td>{job.apps || "–"}</td><td>{job.conv}</td>
          <td style={{ textAlign: "right" }}><Link href="/recruiting/jobs/new" className="icon-btn">✏️</Link> <button type="button" className="icon-btn" onClick={() => toggleArchive(job.id)}>{job.status === "archived" ? "↩️" : "🗄️"}</button></td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}

function JobCreate({ t, locale }: { t: T; locale: Locale }) {
  const router = useRouter();
  const { jobs, setJobs } = useRecruiting();
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState<DeptId>("reception");
  const [type, setType] = useState("fullOrPart");
  const [start, setStart] = useState("");
  const [notes, setNotes] = useState("");
  const [langs, setLangs] = useState<Record<Locale, boolean>>({ de: true, en: false, it: false });
  const [previewLang, setPreviewLang] = useState<Locale>(locale);
  const [generated, setGenerated] = useState(false);
  const [image, setImage] = useState("");
  const [logo, setLogo] = useState("");
  const typeLabel = type === "full" ? t.typeFull : type === "part" ? t.typePart : type === "apprentice" ? t.typeApprentice : t.typeFullOrPart;
  function generate() { setGenerated(true); setPreviewLang(langs.de ? "de" : langs.en ? "en" : "it"); }
  function save(status: JobStatus) {
    if (!title.trim()) return;
    setJobs([{ id: `job_${Date.now()}`, title: title.trim(), dept, type, start: start.trim() || t.immediately, notes, status, langs: (["de", "en", "it"] as Locale[]).filter((lang) => langs[lang]), clicks: 0, apps: 0, conv: "–" }, ...jobs]);
    alert(status === "active" ? t.published : t.savedDraft);
    router.push("/recruiting/jobs");
  }
  return <>
    <Back href="/recruiting/jobs" label={t.backJobs} />
    <div className="g2">
      <div>
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
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="ch"><div className="ct">{t.basicsStep}</div></div>
          <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label><span className="field-lbl">{t.roleTitle}</span><input className="field-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.rolePlaceholder} /></label>
            <div className="field-row">
              <label><span className="field-lbl">{t.department}</span><select className="field-select" value={dept} onChange={(event) => setDept(event.target.value as DeptId)}>{deptIds.map((item) => <option key={item} value={item}>{t.depts[item]}</option>)}</select></label>
              <label><span className="field-lbl">{t.workType}</span><select className="field-select" value={type} onChange={(event) => setType(event.target.value)}>
                <option value="fullOrPart">{t.typeFullOrPart}</option><option value="full">{t.typeFull}</option><option value="part">{t.typePart}</option><option value="apprentice">{t.typeApprentice}</option>
              </select></label>
            </div>
            <label><span className="field-lbl">{t.startFrom}</span><input className="field-input" value={start} onChange={(event) => setStart(event.target.value)} placeholder={t.startPlaceholder} /></label>
            <label><span className="field-lbl">{t.aiNotes}</span><input className="field-input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t.aiNotesPlaceholder} /></label>
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
              <span className="field-lbl">{t.listingImage}</span>
              <button type="button" className="dropzone" style={{ marginBottom: 0 }} onClick={() => { const name = prompt(t.listingImage, "Stellenanzeige-Foto.jpg"); if (name) setImage(name); }}>{t.uploadImage}<br /><span style={{ fontSize: 11 }}>{t.dropOrClick}</span></button>
              {image ? <div className="doc-row"><div className="doc-ic">📷</div><div className="doc-name">{image}</div><button type="button" className="icon-btn danger" onClick={() => setImage("")}>🗑️</button></div> : null}
            </div>
            <div>
              <span className="field-lbl">{t.logo}</span>
              <button type="button" className="dropzone" style={{ marginBottom: 0 }} onClick={() => { const name = prompt(t.logo, "Weihrerhof-Logo.png"); if (name) setLogo(name); }}>{t.uploadLogo}<br /><span style={{ fontSize: 11 }}>{t.logoReuse}</span></button>
              {logo ? <div className="doc-row"><div className="doc-ic">🏷️</div><div className="doc-name">{logo}</div><button type="button" className="icon-btn danger" onClick={() => setLogo("")}>🗑️</button></div> : null}
            </div>
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
          {generated ? <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 6 }}>{t.formFormat} · {t.preview}</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{title || t.newPosition}</div>
            <div style={{ fontSize: 12.5, color: "var(--text2)", marginBottom: 14 }}>{typeLabel} · {t.depts[dept]} · {t.startLabel}: {start || t.immediately}</div>
            <div style={{ background: "var(--bg)", borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 13, lineHeight: 1.6 }}>{fill(t.lookingFor, { dept: t.depts[dept] })}{notes ? ` – ${notes}` : ""}.</div>
            {[t.formFields1, fill(t.formFields2, { dept: t.depts[dept] }), t.formFields3].map((line) => <div className="doc-row" style={{ padding: "8px 12px" }} key={line}><div className="doc-name">{line}</div></div>)}
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <button type="button" className="btn btn-primary" onClick={() => save("active")}>{t.publish}</button>
              <button type="button" className="btn btn-ghost" onClick={() => save("draft")}>{t.saveDraft}</button>
            </div>
          </> : <div style={{ fontSize: 12.5, color: "var(--text3)", textAlign: "center", padding: "30px 10px" }}>{t.previewEmpty}</div>}
        </div>
      </div>
    </div>
  </>;
}

function JobQuiz({ t, locale }: { t: T; locale: Locale }) {
  const router = useRouter();
  const { jobs, setJobs } = useRecruiting();
  const [pagesByLang, setPagesByLang] = useState<Record<Locale, QuizPage[]>>(() => ({
    de: createDefaultQuiz(getRecruitingMessages("de")),
    en: createDefaultQuiz(getRecruitingMessages("en")),
    it: createDefaultQuiz(getRecruitingMessages("it")),
  }));
  const [activePageId, setActivePageId] = useState("advantages");
  const [selectedElId, setSelectedElId] = useState<string | null>(null);
  const [footer, setFooter] = useState<QuizFooter>({ impressumUrl: DEFAULT_FOOTER_URL, privacyUrl: DEFAULT_FOOTER_URL });
  const quizPages = pagesByLang[locale];
  function setQuizPages(pages: QuizPage[]) {
    setPagesByLang({ ...pagesByLang, [locale]: pages });
  }
  function save(status: JobStatus) {
    setJobs([{ id: `job_${Date.now()}`, title: t.quizName, dept: "reception", type: "fullOrPart", start: t.immediately, notes: "", status, langs: [locale], clicks: 0, apps: 0, conv: "–" }, ...jobs]);
    alert(status === "active" ? t.published : t.savedDraft);
    router.push("/recruiting/jobs");
  }
  return <>
    <Back href="/recruiting/jobs/new" label={t.backToClassic} />
    <div className="g2 g2-quiz">
      <QuizToolsCard t={t} pages={quizPages} setPages={setQuizPages} activePageId={activePageId} setActivePageId={setActivePageId} selectedId={selectedElId} setSelectedId={setSelectedElId} footer={footer} setFooter={setFooter} />
      <QuizCanvasCard t={t} pages={quizPages} setPages={setQuizPages} activePageId={activePageId} setActivePageId={setActivePageId} selectedId={selectedElId} setSelectedId={setSelectedElId} footer={footer} setFooter={setFooter} onPublish={() => save("active")} onDraft={() => save("draft")} />
    </div>
  </>;
}

function Applications({ t }: { t: T }) {
  const { applicants } = useRecruiting();
  const [filter, setFilter] = useState<"all" | AppStage>("all");
  const [search, setSearch] = useState("");
  const rows = applicants.filter((item) => (filter === "all" || item.stage === filter) && `${item.name} ${t.depts[item.dept]}`.toLowerCase().includes(search.toLowerCase()));
  const filters: Array<["all" | AppStage, string]> = [["all", t.all], ["new", t.stageNew], ["invited", t.stageInvited], ["offer", t.stageOffer], ["hired", t.stageHired], ["rejected", t.stageRejected], ["archived", t.stageArchived]];
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
  </>;
}

function ApplicationCreate({ t }: { t: T }) {
  const router = useRouter();
  const { applicants, setApplicants } = useRecruiting();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dept, setDept] = useState<DeptId>("reception");
  const [message, setMessage] = useState("");
  const [cv, setCv] = useState("");
  function save(event: FormEvent) {
    event.preventDefault();
    if (!first.trim() || !last.trim()) { alert(t.requiredName); return; }
    const name = `${first.trim()} ${last.trim()}`;
    const id = `app_${Date.now()}`;
    const next: Applicant = { id, initials: `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase(), name, role: t.depts[dept], dept, stage: "new", dateDisplay: null, score: "–", suggestion: "manualAdded", email: email.trim() || "–", phone: phone.trim() || "–", bestTime: "–", date: new Date().toLocaleDateString(), source: t.manualAdded, cv: cv || null, message: message.trim(), competencies: { social: 0, professional: 0, methodical: 0, personal: 0 }, tags: [], comments: [] };
    setApplicants([next, ...applicants]);
    alert(fill(t.addedApp, { name }));
    router.push("/recruiting/applications");
  }
  return <>
    <Back href="/recruiting/applications" label={t.backApplications} />
    <form className="card" style={{ maxWidth: 460 }} onSubmit={save}>
      <div className="ch"><div className="ct">{t.applicationCreateTitle}</div></div>
      <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="field-row">
          <label><span className="field-lbl">{t.firstName}</span><input className="field-input" value={first} onChange={(event) => setFirst(event.target.value)} placeholder={t.firstNamePh} /></label>
          <label><span className="field-lbl">{t.lastName}</span><input className="field-input" value={last} onChange={(event) => setLast(event.target.value)} placeholder={t.lastNamePh} /></label>
        </div>
        <label><span className="field-lbl">{t.email}</span><input className="field-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
        <label><span className="field-lbl">{t.phone}</span><input className="field-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+39 ..." /></label>
        <label><span className="field-lbl">{t.department}</span><select className="field-select" value={dept} onChange={(event) => setDept(event.target.value as DeptId)}>{deptIds.map((item) => <option key={item} value={item}>{t.depts[item]}</option>)}</select></label>
        <label><span className="field-lbl">{t.message}</span><textarea className="field-input" style={{ minHeight: 80, resize: "vertical" }} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t.optional} /></label>
        <div>
          <span className="field-lbl">{t.cv}</span>
          <button type="button" className="dropzone" style={{ marginBottom: 0 }} onClick={() => { const name = prompt(t.cv, "Lebenslauf.pdf"); if (name) setCv(name); }}>{t.uploadCv}<br /><span style={{ fontSize: 11 }}>{t.dropOrClick}</span></button>
          {cv ? <div className="doc-row"><div className="doc-ic">📄</div><div className="doc-name">{cv}</div><button type="button" className="icon-btn danger" onClick={() => setCv("")}>🗑️</button></div> : null}
        </div>
        <button type="submit" className="btn btn-primary">{t.save}</button>
      </div>
    </form>
  </>;
}

function ApplicationDetail({ t, id }: { t: T; id: string }) {
  const router = useRouter();
  const { applicants, setApplicants, employees, setEmployees } = useRecruiting();
  const item = applicants.find((row) => row.id === id);
  const [comment, setComment] = useState("");
  const [tag, setTag] = useState("");
  if (!item) return <><Back href="/recruiting/applications" label={t.backApplications} /><p>{t.loading}</p></>;
  function update(patch: Partial<Applicant>) { setApplicants(applicants.map((row) => row.id === id ? { ...row, ...patch } : row)); }
  function setStage(stage: AppStage) {
    const today = new Date().toLocaleDateString();
    update({ stage, dateDisplay: stage === "offer" ? fill(t.offerOn, { date: today }) : item!.dateDisplay });
    alert(fill(stage === "offer" ? t.offerSent : t.rejectSent, { name: item!.name }));
  }
  function convert() {
    if (employees.some((row) => row.id === id)) { alert(fill(t.alreadyEmployee, { name: item!.name })); router.push(`/recruiting/employees/${id}`); return; }
    const next: Employee = { id, initials: item!.initials, name: item!.name, dept: item!.dept, status: "active", reason: "", email: item!.email, phone: item!.phone, taxId: t.stillNeeded, birthdate: "", birthplace: t.stillNeeded, employment: new Date().toLocaleDateString(), comments: fill(t.fromApplication, { date: item!.date }), tags: [...item!.tags], certificates: [] };
    setEmployees([next, ...employees]);
    alert(fill(t.converted, { name: item!.name }));
    router.push(`/recruiting/employees/${id}`);
  }
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
          <div className="cb" style={{ borderTop: "1px solid var(--border)" }}><div className="field-lbl" style={{ marginBottom: 6 }}>{t.message}</div><div style={{ fontSize: 13, lineHeight: 1.6 }}>{item.message}</div></div>
        </div>
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
              <input className="field-input" value={tag} placeholder={t.tagsPlaceholder} onChange={(event) => setTag(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (tag.trim()) { update({ tags: [...item.tags, tag.trim()] }); setTag(""); } } }} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{item.tags.map((entry, index) => <span className="chip chip-n" key={`${entry}-${index}`}>{entry} <button type="button" onClick={() => update({ tags: item.tags.filter((_, i) => i !== index) })}>✕</button></span>)}</div>
            </label>
            {item.comments.map((entry, index) => <div key={`${entry.date}-${index}`} style={{ background: "var(--bg)", borderRadius: 8, padding: "10px 12px" }}><div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{entry.text}</div><div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>{entry.author} · {entry.date}</div></div>)}
            <button type="button" className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={() => { if (!comment.trim()) { alert(t.enterComment); return; } update({ comments: [...item.comments, { text: comment.trim(), author: "Klaus", date: new Date().toLocaleDateString() }] }); setComment(""); }}>{t.save}</button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="ch"><div className="ct">{t.actions}</div></div>
        <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" className="btn btn-primary" onClick={() => setStage("offer")}>{t.sendOffer}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setStage("rejected")}>{t.reject}</button>
          <button type="button" className="btn btn-ghost" onClick={convert}>{t.makeEmployee}</button>
        </div>
      </div>
    </div>
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

function Emails({ t, locale }: { t: T; locale: Locale }) {
  const { emails, setEmails } = useRecruiting();
  const [cat, setCat] = useState<EmailCat>("received");
  const [lang, setLang] = useState<Locale>(locale);
  const current = emails[cat][lang];
  function change(field: "subject" | "body", value: string) {
    setEmails({ ...emails, [cat]: { ...emails[cat], [lang]: { ...current, [field]: value } } });
  }
  return <>
    <Back href="/recruiting" label={t.backRecruiting} />
    <div className="card">
      <div className="ch" style={{ flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
        <div className="bud-tab-row">
          {([["received", t.catReceived], ["offer", t.catOffer], ["reject", t.catReject]] as const).map(([key, label]) =>
            <button key={key} type="button" className={`bud-tab ${cat === key ? "active" : ""}`} onClick={() => setCat(key)}>{label}</button>)}
        </div>
        <div style={{ display: "flex", gap: 6 }}>{(["de", "en", "it"] as Locale[]).map((item) =>
          <button key={item} type="button" className={`filter-btn ${lang === item ? "active" : ""}`} onClick={() => setLang(item)}>{item.toUpperCase()}</button>)}</div>
      </div>
      <div className="cb">
        <div style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 10 }}>{t.placeholders} <code>{"{{name}}"}</code> <code>{"{{job_name}}"}</code> <code>{"{{hotel_name}}"}</code> <code>{"{{hotel_email}}"}</code> <code>{"{{logo}}"}</code></div>
        <label><span className="field-lbl">{t.subject}</span><input className="field-input" style={{ marginBottom: 12 }} value={current.subject} onChange={(event) => change("subject", event.target.value)} /></label>
        <label><span className="field-lbl">{t.body}</span><textarea className="field-input" style={{ minHeight: 180, resize: "vertical", lineHeight: 1.6 }} value={current.body} onChange={(event) => change("body", event.target.value)} /></label>
        <button type="button" className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => alert(t.templateSaved)}>{t.save}</button>
      </div>
    </div>
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
