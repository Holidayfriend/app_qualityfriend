"use client";

import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/dashboard/app-shell";
import { useI18n } from "../../../components/i18n/i18n-provider";
import { getKnowledgeMessages } from "../../../lib/i18n/knowledge-messages";
import { knowledgeBaseMeta, type KnowledgeBaseKey } from "../../../lib/knowledge-preview-data";

export default function KnowledgePage() {
  const { locale } = useI18n(); const router = useRouter(); const t = getKnowledgeMessages(locale);
  return <AppShell activeItem="settings" pageTitle={t.knowledgeTitle}><main className="p-4 sm:p-5 lg:px-7 lg:py-6">
    <button type="button" onClick={() => router.push("/settings")} className="mb-4 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {t.settings}</button>
    <p className="mb-5 max-w-4xl text-xs leading-[1.6] text-[var(--qf-text-muted)]">{t.knowledgeIntro}</p>
    <section className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
      {(Object.entries(knowledgeBaseMeta) as [KnowledgeBaseKey, (typeof knowledgeBaseMeta)[KnowledgeBaseKey]][]).map(([key, base]) => <button key={key} type="button" onClick={() => router.push(`/settings/knowledge/${key}`)} className="cursor-pointer rounded-[10px] border border-[var(--qf-border)] bg-white p-4 text-left shadow-[var(--qf-shadow)] transition hover:border-[var(--qf-accent)]">
        <span className="block text-[10px] font-bold uppercase tracking-[.7px] text-[var(--qf-accent)]">{base.scope === "hotelWide" ? t.hotelWide : t.department}</span>
        <span className="mt-1.5 block text-[13.5px] font-semibold"><span className="mr-1.5" aria-hidden>{base.icon}</span>{t.bases[key]}</span>
        <span className="mt-1 block text-[11.5px] text-[var(--qf-text-muted)]">{base.files.length} {base.files.length === 1 ? t.document : t.documents}</span>
      </button>)}
    </section>
  </main></AppShell>;
}
