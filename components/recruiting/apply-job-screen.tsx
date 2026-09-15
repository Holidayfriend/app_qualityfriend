"use client";

import { useEffect, useState } from "react";
import { ClassicApplyPage } from "./classic-apply-page";
import { QuizApplyPage } from "./quiz-apply-page";
import { useI18n } from "../i18n/i18n-provider";
import { getRecruitingMessages } from "../../lib/i18n/recruiting-messages";
import type { Locale } from "../../lib/i18n/dictionaries";
import { jobsSeed } from "../../lib/recruiting/preview-data";
import type { QuizFooter, QuizPage } from "./quiz-builder";

type ApplyJob = {
  id: string;
  slug: string;
  format: "classic" | "quiz";
  title: string;
  dept: string;
  type: string;
  start: string;
  notes: string;
  description: string;
  autoMessage: string;
  location: string;
  cvRequired: boolean;
  listingImage?: string;
  logoImage?: string;
  langs: Locale[];
  quiz: { footer: QuizFooter; pages: QuizPage[] } | null;
};

const countedClicks = new Set<string>();

export function ApplyJobScreen({ slug }: { slug: string }) {
  const { locale, setLocale } = useI18n();
  const t = getRecruitingMessages(locale);
  const [job, setJob] = useState<ApplyJob | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let ignore = false;
    const countClick = !countedClicks.has(slug);
    if (countClick) countedClicks.add(slug);
    fetch(`/api/apply/${encodeURIComponent(slug)}?locale=${locale}${countClick ? "&click=1" : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ignore) return;
        if (data?.job) {
          setJob(data.job as ApplyJob);
          setMissing(false);
        } else {
          const seed = jobsSeed.find((item) => item.id === slug);
          if (seed) {
            setJob({
              id: seed.id, slug: seed.id, format: "classic", title: seed.title, dept: seed.dept, type: seed.type,
              start: seed.start, notes: seed.notes, description: seed.description, autoMessage: seed.autoMessage,
              location: seed.location, cvRequired: seed.cvRequired, langs: seed.langs, quiz: null,
            });
            setMissing(false);
          } else setMissing(true);
        }
      })
      .catch(() => { if (!ignore) setMissing(true); });
    return () => { ignore = true; };
  }, [slug, locale]);

  useEffect(() => {
    if (!job?.langs.length) return;
    if (!job.langs.includes(locale)) setLocale(job.langs[0]);
  }, [job, locale, setLocale]);

  if (missing) return <p className="job-apply-missing">Job not found.</p>;
  if (!job) return <p className="job-apply-missing">{t.loading}</p>;
  if (job.format === "quiz") {
    return <QuizApplyPage t={t} slug={job.slug} locale={locale} pages={job.quiz?.pages ?? []} footer={job.quiz?.footer ?? { impressumUrl: "", privacyUrl: "" }} cvRequired={job.cvRequired} langs={job.langs} />;
  }
  return (
    <ClassicApplyPage
      t={t}
      slug={/^[0-9a-f-]{36}$/i.test(job.id) ? job.slug : undefined}
      locale={locale}
      langs={job.langs}
      job={{
        title: job.title, dept: job.dept, type: job.type, start: job.start, notes: job.notes,
        description: job.description, autoMessage: job.autoMessage, location: job.location, cvRequired: job.cvRequired,
        image: job.listingImage || "/recruiting/funnel1.png",
        logo: job.logoImage || "/recruiting/logo-icon.png",
      }}
    />
  );
}
