"use client";

import { useEffect, useState } from "react";
import { ClassicApplyPage } from "./classic-apply-page";
import { QuizApplyPage } from "./quiz-apply-page";
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
const listingLocales: Locale[] = ["de", "en", "it"];

function listingLangs(value: unknown): Locale[] {
  if (!Array.isArray(value)) return ["de"];
  const picked = listingLocales.filter((item) => value.includes(item));
  return picked.length ? picked : ["de"];
}

function pickApplyLocale(langs: Locale[], current: Locale | null): Locale {
  if (current && langs.includes(current)) return current;
  const browser = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "";
  if (listingLocales.includes(browser as Locale) && langs.includes(browser as Locale)) return browser as Locale;
  return langs[0] ?? "de";
}

export function ApplyJobScreen({ slug }: { slug: string }) {
  const [locale, setLocale] = useState<Locale | null>(null);
  const [job, setJob] = useState<ApplyJob | null>(null);
  const [missing, setMissing] = useState(false);
  const t = getRecruitingMessages(locale ?? "de");

  useEffect(() => {
    let ignore = false;
    const countClick = !countedClicks.has(slug);
    if (countClick) countedClicks.add(slug);
    const params = new URLSearchParams();
    if (locale) params.set("locale", locale);
    if (countClick) params.set("click", "1");
    const query = params.toString();
    fetch(`/api/apply/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ignore) return;
        if (data?.job) {
          const langs = listingLangs(data.job.langs);
          const nextLocale = pickApplyLocale(langs, locale);
          if (!locale || locale !== nextLocale) {
            setLocale(nextLocale);
            return;
          }
          setJob({ ...data.job, langs } as ApplyJob);
          setMissing(false);
        } else {
          const seed = jobsSeed.find((item) => item.id === slug);
          if (seed) {
            const langs = listingLangs(seed.langs);
            const nextLocale = pickApplyLocale(langs, locale);
            if (!locale || locale !== nextLocale) {
              setLocale(nextLocale);
              return;
            }
            setJob({
              id: seed.id, slug: seed.id, format: "classic", title: seed.title, dept: seed.dept, type: seed.type,
              start: seed.start, notes: seed.notes, description: seed.description, autoMessage: seed.autoMessage,
              location: seed.location, cvRequired: seed.cvRequired, langs, quiz: null,
            });
            setMissing(false);
          } else setMissing(true);
        }
      })
      .catch(() => { if (!ignore) setMissing(true); });
    return () => { ignore = true; };
  }, [slug, locale]);

  useEffect(() => {
    const href = job?.logoImage;
    if (!href) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    const previous = link.getAttribute("href");
    link.href = href;
    return () => {
      if (previous) link.setAttribute("href", previous);
    };
  }, [job?.logoImage]);

  if (missing) return <p className="job-apply-missing">Job not found.</p>;
  if (!job || !locale) return <p className="job-apply-missing">{t.loading}</p>;
  if (job.format === "quiz") {
    return (
      <QuizApplyPage
        key={locale}
        t={t}
        slug={job.slug}
        locale={locale}
        pages={job.quiz?.pages ?? []}
        footer={job.quiz?.footer ?? { impressumUrl: "", privacyUrl: "" }}
        cvRequired={job.cvRequired}
        langs={job.langs}
        onLocaleChange={setLocale}
      />
    );
  }
  return (
    <ClassicApplyPage
      t={t}
      slug={/^[0-9a-f-]{36}$/i.test(job.id) ? job.slug : undefined}
      locale={locale}
      langs={job.langs}
      onLocaleChange={setLocale}
      job={{
        title: job.title, dept: job.dept, type: job.type, start: job.start, notes: job.notes,
        description: job.description, autoMessage: job.autoMessage, location: job.location, cvRequired: job.cvRequired,
        image: job.listingImage || "/recruiting/funnel1.png",
        logo: job.logoImage || "/recruiting/logo-icon.png",
      }}
    />
  );
}
