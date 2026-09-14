"use client";

import { useState, type FormEvent } from "react";
import { fill, type DeptId, type RecruitingMessages } from "../../lib/i18n/recruiting-messages";
import { LanguageSwitcher } from "../i18n/language-switcher";
import { htmlToPlain, sanitizeJobHtml } from "./rich-text-editor";

type T = RecruitingMessages;

export type ClassicApplyJob = {
  title: string;
  dept: DeptId;
  type: string;
  start: string;
  notes: string;
  description: string;
  autoMessage: string;
  location: string;
  cvRequired: boolean;
  image: boolean;
  logo: boolean;
};

export function ClassicApplyPage({ t, job }: { t: T; job: ClassicApplyJob }) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState<"mr" | "mrs" | "divers">("mr");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [cvName, setCvName] = useState("");
  const [showRetention, setShowRetention] = useState(false);
  const typeLabel = job.type === "full" ? t.typeFull : job.type === "part" ? t.typePart : job.type === "apprentice" ? t.typeApprentice : t.typeFullOrPart;
  const benefits = job.notes.split(/[,;•]/).map((item) => item.trim()).filter(Boolean);
  const html = sanitizeJobHtml(htmlToPlain(job.description) ? job.description : `<p>${fill(t.lookingFor, { dept: t.depts[job.dept] })}.</p>`);
  const role = job.title.trim() || t.newPosition;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!first.trim() || !last.trim()) {
      setError(t.requiredName);
      return;
    }
    if (job.cvRequired && !cvName) {
      setError(t.cvRequired);
      return;
    }
    setError("");
    setDone(true);
  }

  return (
    <div className="job-apply">
      <header className="job-apply-bar">
        {job.logo ? <img className="job-apply-logo" src="/recruiting/logo-icon.png" alt="" /> : <span className="job-apply-logo-empty">QF</span>}
        <LanguageSwitcher />
      </header>
      <img className="job-apply-photo" src={job.image ? "/recruiting/funnel1.png" : "/recruiting/image-placeholder.png"} alt="" />
      <main className="job-apply-main">
        {done ? (
          <div className="job-apply-box job-apply-thanks">
            <p className="job-apply-ok">✓</p>
            <h1>{t.thanksCopy}</h1>
          </div>
        ) : (
          <>
            <div className="job-apply-box">
              <h1>{role}</h1>
              <p className="job-apply-meta">{typeLabel} · {t.depts[job.dept]} · {t.startLabel}: {job.start.trim() || t.immediately}</p>
              {job.location.trim() ? <p className="job-apply-place">📍 {t.location}: {job.location.trim()}</p> : null}
              <div className="job-desc-preview" dangerouslySetInnerHTML={{ __html: html }} />
              {benefits.length ? (
                <ul className="job-apply-benefits">
                  <li className="job-apply-benefits-title">{t.ourBenefits}</li>
                  {benefits.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </div>
            <form className="job-apply-box" onSubmit={submit}>
              <h2>{t.applyNow.replace(/ \(.*\)/, "")}</h2>
              <p className="job-apply-salute">{t.salutation}</p>
              <div className="job-apply-titles" role="radiogroup" aria-label={t.salutation}>
                {([["mr", t.titleMr], ["mrs", t.titleMrs], ["divers", t.titleDivers]] as const).map(([id, label]) =>
                  <label key={id} className={title === id ? "on" : ""}>
                    <input type="radio" name="salute" checked={title === id} onChange={() => setTitle(id)} />
                    {label}
                  </label>)}
              </div>
              <div className="job-apply-row">
                <label>{t.firstName}<input value={first} onChange={(event) => setFirst(event.target.value)} /></label>
                <label>{t.lastName}<input value={last} onChange={(event) => setLast(event.target.value)} /></label>
              </div>
              <label>{t.email}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label>{t.phone}<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
              <label>{t.message}<textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t.optional} /></label>
              <label>
                {t.cv}{job.cvRequired ? "" : ` (${t.optional})`}
                <span className="job-apply-cv">
                  <input type="file" accept=".pdf,.doc,.docx,application/pdf" onChange={(event) => setCvName(event.target.files?.[0]?.name ?? "")} />
                  {cvName ? <em>{cvName}</em> : <small>{t.clickOrDropFile}</small>}
                </span>
              </label>
              <label className="job-apply-agree"><input type="checkbox" required /> {t.dataProtectionNotice}</label>
              <label className="job-apply-agree">
                <input type="checkbox" required />
                <span>
                  {t.keepForOtherJobs.split("{here}")[0]}
                  <button type="button" className="job-apply-here" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setShowRetention(true); }}>{t.hereLink}</button>
                  {t.keepForOtherJobs.split("{here}")[1]}
                </span>
              </label>
              {error ? <p className="job-apply-error">{error}</p> : null}
              <button type="submit" className="job-apply-btn">{t.applyNow.replace(/ \(.*\)/, "")}</button>
            </form>
          </>
        )}
      </main>
      {showRetention ? (
        <div className="job-apply-overlay" onClick={() => setShowRetention(false)}>
          <div className="job-apply-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <p>{t.retentionNote}</p>
            <button type="button" className="job-apply-btn" onClick={() => setShowRetention(false)}>OK</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
