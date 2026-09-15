"use client";

import { useState, type FormEvent } from "react";
import { fill, type RecruitingMessages } from "../../lib/i18n/recruiting-messages";
import type { Locale } from "../../lib/i18n/dictionaries";
import { LanguageSwitcher } from "../i18n/language-switcher";
import { htmlToPlain, sanitizeJobHtml } from "./rich-text-editor";

type T = RecruitingMessages;

export type ClassicApplyJob = {
  title: string;
  dept: string;
  type: string;
  start: string;
  notes: string;
  description: string;
  autoMessage: string;
  location: string;
  cvRequired: boolean;
  image: string;
  logo: string;
};

export function ClassicApplyPage({ t, job, slug, locale, langs, onLocaleChange }: { t: T; job: ClassicApplyJob; slug?: string; locale?: string; langs?: Locale[]; onLocaleChange?: (locale: Locale) => void }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState<"mr" | "mrs" | "divers">("mr");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [cvName, setCvName] = useState("");
  const [keep, setKeep] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [showRetention, setShowRetention] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const typeLabel = job.type === "full" ? t.typeFull : job.type === "part" ? t.typePart : job.type === "apprentice" ? t.typeApprentice : t.typeFullOrPart;
  const benefits = job.notes.split(/[,;•]/).map((item) => item.trim()).filter(Boolean);
  const html = sanitizeJobHtml(htmlToPlain(job.description) ? job.description : `<p>${fill(t.lookingFor, { dept: job.dept })}.</p>`);
  const role = job.title.trim() || t.newPosition;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setShowErrors(true);
    const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
    const checksOk = privacy && keep;
    if (!first.trim() || !last.trim() || !emailOk || (job.cvRequired && !cvName) || !checksOk) {
      setError(checksOk ? "" : t.agreeRequired);
      return;
    }
    setError("");
    if (slug) {
      setBusy(true);
      const res = await fetch(`/api/apply/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale, salutation: title, firstName: first.trim(), lastName: last.trim(), email: email.trim(),
          phone: phone.trim(), message: message.trim(), cvFileName: cvName, keepForOtherJobs: keep,
        }),
      });
      setBusy(false);
      if (!res.ok) {
        setError(t.saveFailed);
        return;
      }
    }
    setDone(true);
  }

  return (
    <div className="job-apply">
      <header className="job-apply-bar">
        {job.logo ? <img className="job-apply-logo" src={job.logo} alt="" /> : <span className="job-apply-logo-empty">QF</span>}
        {langs && langs.length > 1 ? <LanguageSwitcher locales={langs} locale={locale as Locale | undefined} onLocaleChange={onLocaleChange} /> : null}
      </header>
      <img className="job-apply-photo" src={job.image || "/recruiting/image-placeholder.png"} alt="" />
      <main className="job-apply-main">
        {done ? (
          <div className="job-apply-box job-apply-thanks">
            <p className="job-apply-ok">✓</p>
            {htmlToPlain(job.autoMessage) ? (
              <div className="job-desc-preview job-apply-thanks-copy" dangerouslySetInnerHTML={{ __html: sanitizeJobHtml(job.autoMessage) }} />
            ) : (
              <h1>{t.thanksCopy}</h1>
            )}
          </div>
        ) : (
          <>
            <div className="job-apply-box">
              <h1>{role}</h1>
              <p className="job-apply-meta">{typeLabel} · {job.dept} · {t.startLabel}: {job.start.trim() || t.immediately}</p>
              {job.location.trim() ? <p className="job-apply-place">📍 {t.location}: {job.location.trim()}</p> : null}
              <div className="job-desc-preview" dangerouslySetInnerHTML={{ __html: html }} />
              {benefits.length ? (
                <ul className="job-apply-benefits">
                  <li className="job-apply-benefits-title">{t.ourBenefits}</li>
                  {benefits.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </div>
            <form className="job-apply-box" onSubmit={submit} noValidate>
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
                <label>{t.firstName}<input className={showErrors && !first.trim() ? "is-invalid" : ""} value={first} onChange={(event) => setFirst(event.target.value)} /></label>
                <label>{t.lastName}<input className={showErrors && !last.trim() ? "is-invalid" : ""} value={last} onChange={(event) => setLast(event.target.value)} /></label>
              </div>
              <label>{t.email}<input className={showErrors && !/^\S+@\S+\.\S+$/.test(email.trim()) ? "is-invalid" : ""} type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <label>{t.phone}<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
              <label>{t.message}<textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t.optional} /></label>
              <label>
                {t.cv}{job.cvRequired ? "*" : ` (${t.optional})`}
                <span className={`job-apply-cv${showErrors && job.cvRequired && !cvName ? " is-invalid" : ""}`}>
                  <input type="file" accept=".pdf,.doc,.docx,application/pdf" onChange={(event) => setCvName(event.target.files?.[0]?.name ?? "")} />
                  {cvName ? <em>{cvName}</em> : <small>{t.clickOrDropFile}</small>}
                </span>
              </label>
              <label className={`job-apply-agree${showErrors && !privacy ? " is-invalid" : ""}`}>
                <input type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} /> {t.dataProtectionNotice}
              </label>
              <label className={`job-apply-agree${showErrors && !keep ? " is-invalid" : ""}`}>
                <input type="checkbox" checked={keep} onChange={(event) => setKeep(event.target.checked)} />
                <span>
                  {t.keepForOtherJobs.split("{here}")[0]}
                  <button type="button" className="job-apply-here" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setShowRetention(true); }}>{t.hereLink}</button>
                  {t.keepForOtherJobs.split("{here}")[1]}
                </span>
              </label>
              {error ? <p className="job-apply-error">{error}</p> : null}
              <button type="submit" className="job-apply-btn" disabled={busy}>{t.applyNow.replace(/ \(.*\)/, "")}</button>
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
