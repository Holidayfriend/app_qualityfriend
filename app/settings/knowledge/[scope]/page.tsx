"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "../../../../components/dashboard/app-shell";
import { useI18n } from "../../../../components/i18n/i18n-provider";
import { FileDropZone } from "../../../../components/settings/file-drop-zone";
import { getKnowledgeMessages } from "../../../../lib/i18n/knowledge-messages";
import { isKnowledgeBaseKey, knowledgeBaseMeta, previewFiles, type PreviewFile } from "../../../../lib/knowledge-preview-data";

export default function KnowledgeDetailPage() {
  const params = useParams<{ scope: string }>(); const router = useRouter(); const { locale } = useI18n(); const t = getKnowledgeMessages(locale);
  const key = isKnowledgeBaseKey(params.scope) ? params.scope : "hotel"; const base = knowledgeBaseMeta[key];
  const initial = useMemo(() => previewFiles(key), [key]); const [files, setFiles] = useState<PreviewFile[]>(initial); const [notice, setNotice] = useState("");
  function addFiles(selected: File[]) { const valid = selected.filter(file => { if (file.size > 20 * 1024 * 1024) { setNotice(t.fileTooLarge); return false; } if (!/\.(pdf|docx|txt)$/i.test(file.name)) { setNotice(t.invalidType); return false; } return true; }); if (!valid.length) return; const date = new Intl.DateTimeFormat(locale).format(new Date()); setFiles(items => [...items, ...valid.map((file, index) => ({ id: `${file.name}-${file.lastModified}-${index}`, name: file.name, updated: date, status: "current" as const }))]); setNotice(t.uploadReady); }
  return <AppShell activeItem="settings" pageTitle={t.knowledgeTitle}><main className="p-4 sm:p-5 lg:px-7 lg:py-6">
    <button type="button" onClick={() => router.push("/settings/knowledge")} className="mb-5 cursor-pointer text-[12.5px] font-semibold text-[var(--qf-text-muted)] hover:text-[var(--qf-accent)]">← {t.knowledgeTitle}</button>
    <section className="overflow-hidden rounded-[var(--qf-radius)] border border-[var(--qf-border)] bg-white shadow-[var(--qf-shadow)]">
      <header className="flex flex-col gap-3 border-b border-[var(--qf-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div><h1 className="text-[14px] font-bold">{base.icon} {t.bases[key]}</h1><p className="mt-1 text-[11.5px] text-[var(--qf-text-muted)]">{base.scope === "hotelWide" ? t.hotelWide : t.department} · {files.length} {files.length === 1 ? t.document : t.documents} · {t.sharedWithManuals}</p></div>
        <code className="w-fit rounded-md bg-[var(--qf-background)] px-2.5 py-1.5 text-[10px] text-[var(--qf-text-muted)]">{base.storeId}</code>
      </header>
      <div className="p-4 sm:p-5"><FileDropZone label={t.uploadDocument} messages={t} onFiles={addFiles} />{notice ? <p role="status" className={`mt-3 rounded-md px-3 py-2 text-[11.5px] ${notice === t.uploadReady ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{notice}</p> : null}<FileList files={files} t={t} onRemove={(id) => { if (window.confirm(t.removeConfirm)) setFiles(items => items.filter(file => file.id !== id)); }} /></div>
    </section>
    <p className="mt-3 text-[10.5px] text-[var(--qf-text-light)]">ⓘ {t.previewNote}</p>
  </main></AppShell>;
}

function FileList({ files, t, onRemove }: { files: PreviewFile[]; t: ReturnType<typeof getKnowledgeMessages>; onRemove: (id: string) => void }) {
  const statusStyle = { current: "bg-green-100 text-green-700", review: "bg-amber-100 text-amber-700", outdated: "bg-red-100 text-red-700" };
  if (!files.length) return <p className="py-8 text-center text-xs text-[var(--qf-text-light)]">{t.emptyDocuments}</p>;
  return <div className="mt-4">{files.map(file => <div key={file.id} className="flex items-center gap-3 border-b border-[var(--qf-border)] py-3 last:border-0"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--qf-background)]">📄</span><span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-semibold">{file.name}</span><span className="mt-0.5 block text-[10.5px] text-[var(--qf-text-light)]">{t.updated}: {file.updated}</span></span><span className={`hidden rounded-full px-2 py-1 text-[9.5px] font-bold sm:inline ${statusStyle[file.status]}`}>{t[file.status]}</span><button type="button" onClick={() => onRemove(file.id)} aria-label={`${t.remove}: ${file.name}`} title={t.remove} className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-sm text-[var(--qf-text-light)] transition hover:bg-red-50 hover:text-red-600">🗑️</button></div>)}</div>;
}
