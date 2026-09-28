"use client";

import Link from "next/link";
import { LanguageSwitcher } from "../i18n/language-switcher";
import { useI18n } from "../i18n/i18n-provider";
import { legalDocument } from "../../lib/legal/documents";

export function LegalDocumentPage({ kind }: { kind: "terms" | "privacy" }) {
  const { locale } = useI18n();
  const copy = legalDocument(kind, locale);

  return (
    <main className="min-h-screen bg-[var(--qf-background)] px-5 py-8 sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/register" className="text-[13px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {copy.back}</Link>
          <LanguageSwitcher />
        </div>
        <article className="rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-[var(--qf-surface)] p-6 shadow-[var(--qf-shadow)] sm:p-10">
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--qf-text)]">{copy.title}</h1>
          <p className="mt-2 text-[12px] text-[var(--qf-text-muted)]">{copy.updated}</p>
          <p className="mt-6 text-sm leading-7 text-[var(--qf-text)]">{copy.intro}</p>
          <div className="mt-8 space-y-7">
            {copy.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-[16px] font-bold text-[var(--qf-text)]">{section.heading}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-2 text-sm leading-7 text-[var(--qf-text-muted)]">{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
